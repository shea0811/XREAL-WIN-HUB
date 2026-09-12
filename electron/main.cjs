'use strict';

const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron');
const { execFile, spawn } = require('node:child_process');
const { promises: fs } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const STATE_FILE = 'hub-state.json';
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

const channels = Object.freeze({
  loadState: 'state:load',
  saveState: 'state:save',
  snapshot: 'system:snapshot',
  snapshotChanged: 'system:snapshot-changed',
  openExternal: 'system:open-external',
  launchWorkspace: 'workspace:launch',
  moveToDisplay: 'window:move-to-display',
  theatreMode: 'window:theatre-mode',
  alwaysOnTop: 'window:always-on-top',
  loginItem: 'system:login-item',
  simulationMode: 'system:simulation-mode',
  displayLayout: 'display:layout',
  displayPreview: 'display:preview',
  displayConfirm: 'display:confirm',
  displayRevert: 'display:revert',
  displayIdentify: 'display:identify',
});

const SIMULATED_DISPLAY_ID = 'xreal-one-pro-simulated';

/** @type {BrowserWindow | null} */
let mainWindow = null;
let simulationEnabled = false;
let simulatedLayoutOverride = null;
let pendingDisplayTransaction = null;

function statePath() {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function isSafeWebUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function displayLabel(display, index) {
  return display.label?.trim() || `Display ${index + 1}`;
}

function getSnapshot() {
  const primaryId = screen.getPrimaryDisplay().id;
  const displays = screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: displayLabel(display, index),
    primary: display.id === primaryId,
    bounds: display.bounds,
    workArea: display.workArea,
    size: display.size,
    scaleFactor: display.scaleFactor,
    rotation: display.rotation,
  }));

  const physicalXrealDisplay = displays.find((display) =>
    /xreal|nreal|air 2|one pro/i.test(display.label),
  );
  const simulatedDisplay = simulationEnabled && !physicalXrealDisplay
    ? {
        id: SIMULATED_DISPLAY_ID,
        label: 'XREAL One Pro (simulated)',
        primary: false,
        bounds: {
          x: screen.getPrimaryDisplay().bounds.x + screen.getPrimaryDisplay().bounds.width,
          y: screen.getPrimaryDisplay().bounds.y,
          width: 1920,
          height: 1080,
        },
        workArea: {
          x: screen.getPrimaryDisplay().bounds.x + screen.getPrimaryDisplay().bounds.width,
          y: screen.getPrimaryDisplay().bounds.y,
          width: 1920,
          height: 1040,
        },
        size: { width: 1920, height: 1080 },
        scaleFactor: 1,
        rotation: 0,
      }
    : null;
  if (simulatedDisplay) displays.push(simulatedDisplay);
  const xrealDisplay = physicalXrealDisplay ?? simulatedDisplay;

  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    isElectron: true,
    updatedAt: new Date().toISOString(),
    displays,
    xreal: {
      connection: xrealDisplay ? 'display-detected' : 'not-detected',
      displayId: xrealDisplay?.id ?? null,
      deviceName: xrealDisplay?.label ?? null,
      inputSource: physicalXrealDisplay ? 'windows-display' : 'simulation',
      simulated: Boolean(!physicalXrealDisplay && simulatedDisplay),
      capabilities: {
        displayPlacement: true,
        theatreMode: true,
        handTracking: false,
        spatialTracking: false,
        hardwareControls: false,
      },
    },
    privacy: {
      telemetry: false,
      localStorage: true,
    },
  };
}

function electronDisplayLayout() {
  const snapshot = getSnapshot();
  const items = snapshot.displays.map((display, index) => ({
    id: display.id,
    deviceName: display.id,
    label: display.label || `Display ${index + 1}`,
    primary: display.primary,
    internal: false,
    xreal: display.id === snapshot.xreal.displayId || /xreal|nreal|air 2|one pro/i.test(display.label),
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.size.width,
    height: display.size.height,
    rotation: display.rotation,
    scaleFactor: display.scaleFactor,
  }));
  const displays = simulatedLayoutOverride
    ? items.map((item) => simulatedLayoutOverride.find((saved) => saved.id === item.id) ?? item)
    : items;
  return {
    source: simulationEnabled ? 'simulation' : 'electron-fallback',
    canApply: simulationEnabled,
    capturedAt: new Date().toISOString(),
    displays,
    warning: simulationEnabled
      ? 'Simulator mode: layout changes are visual only and do not alter Windows.'
      : 'Windows display controls are unavailable. Run the installed Windows app to apply layouts.',
  };
}

function displayHelperPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'windows-display.ps1');
  }
  return path.join(__dirname, 'windows-display.ps1');
}

async function runDisplayHelper(action, payloadPath) {
  const args = [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', displayHelperPath(), '-Action', action,
  ];
  if (payloadPath) args.push('-PayloadPath', payloadPath);
  const { stdout } = await execFileAsync('powershell.exe', args, {
    windowsHide: true,
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return JSON.parse(stdout.trim());
}

function mergeNativeDisplayDetails(nativeDisplays) {
  const electronDisplays = screen.getAllDisplays();
  return nativeDisplays.map((display, index) => {
    const match = electronDisplays.find((candidate) =>
      candidate.bounds.x === display.x
      && candidate.bounds.y === display.y
      && candidate.size.width === display.width
      && candidate.size.height === display.height,
    );
    const label = match?.label?.trim() || display.label || `Display ${index + 1}`;
    return {
      ...display,
      id: display.deviceName,
      label,
      internal: Boolean(match?.internal),
      xreal: /xreal|nreal|air 2|one pro/i.test(label),
      scaleFactor: match?.scaleFactor ?? 1,
    };
  });
}

async function getDisplayLayout() {
  if (simulationEnabled || process.platform !== 'win32') return electronDisplayLayout();
  try {
    const result = await runDisplayHelper('Get');
    return {
      source: 'windows-native',
      canApply: true,
      capturedAt: new Date().toISOString(),
      displays: mergeNativeDisplayDetails(result.displays ?? []),
    };
  } catch (error) {
    console.error('Unable to read Windows display layout', error);
    return electronDisplayLayout();
  }
}

function assertProposedLayout(proposed, current) {
  if (!Array.isArray(proposed) || proposed.length < 1 || proposed.length > 16) {
    throw new TypeError('The layout must contain between 1 and 16 connected displays.');
  }
  if (proposed.filter((display) => display?.primary === true).length !== 1) {
    throw new TypeError('Exactly one display must be primary.');
  }
  const currentByName = new Map(current.map((display) => [display.deviceName, display]));
  if (new Set(proposed.map((display) => display?.deviceName)).size !== proposed.length) {
    throw new TypeError('The display list contains duplicate devices.');
  }
  for (const display of proposed) {
    const existing = currentByName.get(display?.deviceName);
    if (!existing) throw new TypeError('A display was disconnected before the layout could be applied.');
    if (!Number.isInteger(display.x) || !Number.isInteger(display.y)) {
      throw new TypeError('Display positions must use whole pixels.');
    }
    if (Math.abs(display.x) > 32_000 || Math.abs(display.y) > 32_000) {
      throw new RangeError('A display position is outside the supported desktop range.');
    }
    if (display.width !== existing.width || display.height !== existing.height) {
      throw new TypeError('Resolution changes are not supported by Layout Studio.');
    }
    if (display.primary && (display.x !== 0 || display.y !== 0)) {
      throw new TypeError('The primary display must be positioned at 0,0.');
    }
  }
}

async function stopRollbackWatch(transaction) {
  if (!transaction?.confirmToken) return;
  await fs.writeFile(transaction.confirmToken, 'confirmed', { encoding: 'utf8', mode: 0o600 });
}

async function previewDisplayLayout(proposed) {
  const current = await getDisplayLayout();
  assertProposedLayout(proposed, current.displays);
  if (!current.canApply) throw new Error(current.warning || 'Display layout changes are unavailable.');
  if (pendingDisplayTransaction) await revertDisplayLayout();

  if (current.source === 'simulation') {
    pendingDisplayTransaction = { kind: 'simulation', original: current.displays };
    simulatedLayoutOverride = proposed.map((display) => ({ ...display }));
    return {
      success: true,
      requiresConfirmation: true,
      message: 'Simulated layout preview is active.',
      layout: await getDisplayLayout(),
    };
  }

  const transactionDir = path.join(app.getPath('temp'), `xreal-layout-${process.pid}-${Date.now()}`);
  const originalPath = path.join(transactionDir, 'original.json');
  const proposedPath = path.join(transactionDir, 'proposed.json');
  const confirmToken = path.join(transactionDir, 'confirmed.token');
  await fs.mkdir(transactionDir, { recursive: true });
  await Promise.all([
    fs.writeFile(originalPath, JSON.stringify(current.displays), { encoding: 'utf8', mode: 0o600 }),
    fs.writeFile(proposedPath, JSON.stringify(proposed), { encoding: 'utf8', mode: 0o600 }),
  ]);

  const watcher = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', displayHelperPath(), '-Action', 'Watch', '-PayloadPath', originalPath,
    '-ConfirmToken', confirmToken, '-Seconds', '20',
  ], { detached: true, stdio: 'ignore', windowsHide: true });
  watcher.unref();
  const transaction = { kind: 'windows', originalPath, proposedPath, confirmToken };
  try {
    await runDisplayHelper('Apply', proposedPath);
    pendingDisplayTransaction = transaction;
  } catch (error) {
    await stopRollbackWatch(transaction).catch(() => undefined);
    throw error;
  }
  return {
    success: true,
    requiresConfirmation: true,
    message: 'Windows is previewing the new display arrangement.',
    layout: await getDisplayLayout(),
  };
}

async function confirmDisplayLayout() {
  if (!pendingDisplayTransaction) return false;
  if (pendingDisplayTransaction.kind === 'windows') await stopRollbackWatch(pendingDisplayTransaction);
  pendingDisplayTransaction = null;
  return true;
}

async function revertDisplayLayout() {
  const transaction = pendingDisplayTransaction;
  if (!transaction) return getDisplayLayout();
  if (transaction.kind === 'simulation') {
    simulatedLayoutOverride = transaction.original.map((display) => ({ ...display }));
  } else {
    try {
      await runDisplayHelper('Apply', transaction.originalPath);
    } finally {
      await stopRollbackWatch(transaction).catch(() => undefined);
    }
  }
  pendingDisplayTransaction = null;
  return getDisplayLayout();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

async function identifyDisplays() {
  const displays = screen.getAllDisplays();
  const windows = displays.map((display, index) => {
    const width = 240;
    const height = 150;
    const marker = new BrowserWindow({
      width,
      height,
      x: display.bounds.x + Math.round((display.bounds.width - width) / 2),
      y: display.bounds.y + Math.round((display.bounds.height - height) / 2),
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    marker.setIgnoreMouseEvents(true);
    const label = escapeHtml(displayLabel(display, index));
    const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;font-family:Segoe UI,sans-serif;color:white}main{box-sizing:border-box;width:240px;height:150px;display:grid;place-items:center;text-align:center;background:rgba(7,11,18,.93);border:2px solid #5ee5d5;border-radius:18px;box-shadow:0 0 45px rgba(94,229,213,.35)}strong{display:block;font-size:54px;line-height:1}span{display:block;max-width:205px;margin-top:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#a9c0ca}</style><main><div><strong>${index + 1}</strong><span>${label}</span></div></main>`;
    void marker.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`).then(() => marker.showInactive());
    return marker;
  });
  setTimeout(() => windows.forEach((window) => {
    if (!window.isDestroyed()) window.destroy();
  }), 3000);
  return windows.length > 0;
}

function sendSnapshot() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channels.snapshotChanged, getSnapshot());
  }
}

function resolveDisplay(displayId) {
  const displays = screen.getAllDisplays();
  if (displayId === SIMULATED_DISPLAY_ID) return screen.getPrimaryDisplay();
  return displays.find((display) => String(display.id) === String(displayId)) ?? null;
}

function moveWindowToDisplay(displayId) {
  if (!mainWindow) return false;
  const target = resolveDisplay(displayId);
  if (!target) return false;

  const { x, y, width, height } = target.workArea;
  mainWindow.setBounds({
    x: x + Math.round(width * 0.05),
    y: y + Math.round(height * 0.05),
    width: Math.max(920, Math.round(width * 0.9)),
    height: Math.max(680, Math.round(height * 0.9)),
  });
  mainWindow.focus();
  return true;
}

async function loadState() {
  try {
    const contents = await fs.readFile(statePath(), 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.error('Unable to load local hub state', error);
    }
    return null;
  }
}

async function saveState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('Hub state must be an object.');
  }

  const serialised = JSON.stringify(state, null, 2);
  if (Buffer.byteLength(serialised, 'utf8') > MAX_STATE_BYTES) {
    throw new RangeError('Hub state exceeds the 2 MB local limit.');
  }

  const destination = statePath();
  const temporary = `${destination}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(temporary, serialised, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, destination);
  return true;
}

function registerIpc() {
  ipcMain.handle(channels.loadState, loadState);
  ipcMain.handle(channels.saveState, (_event, state) => saveState(state));
  ipcMain.handle(channels.snapshot, () => getSnapshot());
  ipcMain.handle(channels.openExternal, async (_event, url) => {
    if (!isSafeWebUrl(url)) return false;
    try {
      await shell.openExternal(url);
      return true;
    } catch (error) {
      console.error('Unable to open external URL', error);
      return false;
    }
  });
  ipcMain.handle(channels.launchWorkspace, async (_event, profile, displayId) => {
    const moved = displayId ? moveWindowToDisplay(displayId) : false;
    const targets = Array.isArray(profile?.targets) ? profile.targets : [];
    let opened = 0;
    for (const target of targets.slice(0, 8)) {
      if (isSafeWebUrl(target?.url)) {
        try {
          await shell.openExternal(target.url);
          opened += 1;
        } catch (error) {
          console.error('Unable to open workspace target', error);
        }
      }
    }
    return { opened, moved };
  });
  ipcMain.handle(channels.moveToDisplay, (_event, displayId) =>
    moveWindowToDisplay(displayId),
  );
  ipcMain.handle(channels.theatreMode, (_event, enabled, displayId) => {
    if (!mainWindow) return false;
    if (enabled && displayId) moveWindowToDisplay(displayId);
    mainWindow.setFullScreen(Boolean(enabled));
    return true;
  });
  ipcMain.handle(channels.alwaysOnTop, (_event, enabled) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(Boolean(enabled), 'floating');
    return mainWindow.isAlwaysOnTop();
  });
  ipcMain.handle(channels.loginItem, (_event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle(channels.simulationMode, (_event, enabled) => {
    simulationEnabled = Boolean(enabled);
    simulatedLayoutOverride = null;
    pendingDisplayTransaction = null;
    const snapshot = getSnapshot();
    sendSnapshot();
    return snapshot;
  });
  ipcMain.handle(channels.displayLayout, getDisplayLayout);
  ipcMain.handle(channels.displayPreview, (_event, displays) => previewDisplayLayout(displays));
  ipcMain.handle(channels.displayConfirm, confirmDisplayLayout);
  ipcMain.handle(channels.displayRevert, revertDisplayLayout);
  ipcMain.handle(channels.displayIdentify, identifyDisplays);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'XREAL WIN HUB',
    width: 1440,
    height: 920,
    minWidth: 920,
    minHeight: 680,
    backgroundColor: '#070b12',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeWebUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
      if (isSafeWebUrl(url)) void shell.openExternal(url);
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited unexpectedly', details);
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (DEV_URL) {
    await mainWindow.loadURL(DEV_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  registerIpc();
  screen.on('display-added', sendSnapshot);
  screen.on('display-removed', sendSnapshot);
  screen.on('display-metrics-changed', sendSnapshot);
  try {
    await createWindow();
  } catch (error) {
    console.error('Unable to start XREAL WIN HUB', error);
    dialog.showErrorBox(
      'XREAL WIN HUB could not start',
      'The application could not load its interface. Restart it, or reinstall the latest build if the problem continues.',
    );
    app.quit();
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error) => {
  console.error('Electron initialisation failed', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
