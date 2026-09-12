'use strict';

const { app, BrowserWindow, dialog, ipcMain, screen, shell } = require('electron');
const { promises: fs } = require('node:fs');
const path = require('node:path');

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
});

const SIMULATED_DISPLAY_ID = 'xreal-one-pro-simulated';

/** @type {BrowserWindow | null} */
let mainWindow = null;
let simulationEnabled = false;

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
        bounds: { ...screen.getPrimaryDisplay().bounds },
        workArea: { ...screen.getPrimaryDisplay().workArea },
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
    const snapshot = getSnapshot();
    sendSnapshot();
    return snapshot;
  });
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
