'use strict';

const {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  powerMonitor,
  safeStorage,
  screen,
  session,
  shell,
  WebContentsView,
} = require('electron');
const { execFile, spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { promises: fs } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { createSpotifyAuth } = require('./spotify-auth.cjs');

const execFileAsync = promisify(execFile);

const STATE_FILE = 'hub-state.json';
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

const channels = Object.freeze({
  loadState: 'state:load',
  saveState: 'state:save',
  clearLocalData: 'state:clear',
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
  mediaKey: 'media:key',
  spotifyStatus: 'spotify:status',
  spotifyConnect: 'spotify:connect',
  spotifyDisconnect: 'spotify:disconnect',
  spotifyPlay: 'spotify:play',
  spotifyPlaybackStatus: 'spotify:playback-status',
  spotifyControl: 'spotify:control',
  whatsappStatus: 'whatsapp:status',
  whatsappStatusChanged: 'whatsapp:status-changed',
  whatsappEmbedded: 'whatsapp:embedded',
  whatsappReload: 'whatsapp:reload',
  whatsappNavigate: 'whatsapp:navigate',
  whatsappDetach: 'whatsapp:detach',
  whatsappAlwaysOnTop: 'whatsapp:always-on-top',
  whatsappClearData: 'whatsapp:clear-data',
});

const SIMULATED_DISPLAY_ID = 'xreal-one-pro-simulated';

/** @type {BrowserWindow | null} */
let mainWindow = null;
let simulationEnabled = false;
let simulatedLayoutOverride = null;
let pendingDisplayTransaction = null;
let whatsappView = null;
let whatsappWindow = null;
let whatsappEmbeddedRequested = false;
let whatsappBounds = null;
let whatsappState = 'idle';
const spotifyAuth = createSpotifyAuth({ app, safeStorage, shell });

const WHATSAPP_URL = 'https://web.whatsapp.com/';
const WHATSAPP_PARTITION = 'persist:whatsapp';
const WHATSAPP_PERMISSIONS = new Set(['media', 'notifications', 'clipboard-sanitized-write']);
const grantedWhatsAppPermissions = new Set(['clipboard-sanitized-write']);
const DISPLAY_HELPER_SHA256 = '49367428d9ae8f1746450b7d2a550ea88fc4886e4e2f88f44cf56596b3d997aa';
const IPC_WINDOW_MS = 10_000;
const IPC_MAX_CALLS = 180;
const ipcRateWindows = new Map();
const approvedExternalHosts = new Set([
  'accounts.spotify.com',
  'developer.spotify.com',
  'www.whatsapp.com',
  'faq.whatsapp.com',
]);

function isWhatsAppOrigin(value) {
  try {
    return new URL(value).origin === 'https://web.whatsapp.com';
  } catch {
    return false;
  }
}

function isSafeExternalHttps(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

async function confirmAndOpenExternal(value) {
  if (!isSafeWebUrl(value)) return false;
  const parsed = new URL(value);
  if (!approvedExternalHosts.has(parsed.hostname)) {
    const options = {
      type: 'question',
      title: 'Open external website?',
      message: `Open ${parsed.hostname} in your default browser?`,
      detail: 'Check the hostname carefully. This website will run outside XREAL WIN HUB.',
      buttons: ['Open website', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    };
    const { response } = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);
    if (response !== 0) return false;
    approvedExternalHosts.add(parsed.hostname);
  }
  await shell.openExternal(parsed.toString());
  return true;
}

function isTrustedHubSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents);
}

async function recordSecurityEvent(event, outcome, detail) {
  try {
    const destination = path.join(app.getPath('userData'), 'security-events.log');
    const entry = JSON.stringify({
      at: new Date().toISOString(),
      event: String(event).slice(0, 80),
      outcome: String(outcome).slice(0, 32),
      detail: detail ? String(detail).slice(0, 160) : undefined,
    });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const stats = await fs.stat(destination).catch(() => null);
    if (stats && stats.size > 256 * 1024) {
      await fs.rename(destination, `${destination}.previous`).catch(() => undefined);
    }
    await fs.appendFile(destination, `${entry}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.error('Unable to write security event', error);
  }
}

function enforceIpcRate(channel) {
  const now = Date.now();
  const recent = (ipcRateWindows.get(channel) ?? []).filter((time) => now - time < IPC_WINDOW_MS);
  if (recent.length >= IPC_MAX_CALLS) {
    void recordSecurityEvent(channel, 'blocked', 'rate-limit');
    throw new Error('Too many requests. Try again shortly.');
  }
  recent.push(now);
  ipcRateWindows.set(channel, recent);
}

function registerTrustedHandler(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedHubSender(event)) {
      void recordSecurityEvent(channel, 'blocked', 'untrusted-sender');
      throw new Error('Untrusted IPC sender.');
    }
    enforceIpcRate(channel);
    return handler(...args);
  });
}

function hideWhatsAppForPrivacy(reason = 'privacy-lock') {
  whatsappEmbeddedRequested = false;
  removeWhatsAppView();
  if (whatsappWindow && !whatsappWindow.isDestroyed()) whatsappWindow.hide();
  void recordSecurityEvent('whatsapp:privacy-hide', 'allowed', reason);
  publishWhatsAppStatus('WhatsApp was hidden for privacy. Return to its page when you are ready.');
}

function whatsappStatus(message) {
  const contents = whatsappWindow && !whatsappWindow.isDestroyed()
    ? whatsappWindow.webContents
    : whatsappView?.webContents;
  return {
    supported: true,
    state: whatsappWindow && !whatsappWindow.isDestroyed() ? 'detached' : whatsappState,
    canGoBack: Boolean(contents?.canGoBack()),
    canGoForward: Boolean(contents?.canGoForward()),
    detached: Boolean(whatsappWindow && !whatsappWindow.isDestroyed()),
    ...(message ? { message } : {}),
  };
}

function publishWhatsAppStatus(message) {
  const status = whatsappStatus(message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channels.whatsappStatusChanged, status);
  }
  return status;
}

function configureWhatsAppContents(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalHttps(url)) void confirmAndOpenExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (isWhatsAppOrigin(url)) return;
    event.preventDefault();
    if (isSafeExternalHttps(url)) void confirmAndOpenExternal(url);
  });
  contents.on('did-start-loading', () => {
    whatsappState = 'loading';
    publishWhatsAppStatus();
  });
  contents.on('did-finish-load', () => {
    whatsappState = 'ready';
    publishWhatsAppStatus();
  });
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    whatsappState = 'failed';
    console.error('WhatsApp Web failed to load', { errorCode, errorDescription, validatedURL });
    publishWhatsAppStatus('WhatsApp Web could not connect. Check the network and try again.');
  });
  contents.on('render-process-gone', (_event, details) => {
    whatsappState = 'failed';
    console.error('WhatsApp renderer exited unexpectedly', details);
    publishWhatsAppStatus('The isolated WhatsApp process stopped unexpectedly. Reload it to continue.');
  });
}

function configureWhatsAppSession() {
  const isolatedSession = session.fromPartition(WHATSAPP_PARTITION, { cache: true });
  isolatedSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    isWhatsAppOrigin(requestingOrigin)
      && WHATSAPP_PERMISSIONS.has(permission)
      && grantedWhatsAppPermissions.has(permission),
  );
  isolatedSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    if (!isWhatsAppOrigin(details.requestingUrl) || !WHATSAPP_PERMISSIONS.has(permission)) {
      callback(false);
      return;
    }
    if (grantedWhatsAppPermissions.has(permission)) {
      callback(true);
      return;
    }
    const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes.join(' and ') : '';
    const capability = permission === 'media'
      ? (mediaTypes || 'camera and microphone')
      : 'notifications';
    const promptOptions = {
      type: 'question',
      title: 'WhatsApp permission',
      message: `Allow WhatsApp Web to use ${capability}?`,
      detail: 'This permission applies only to the isolated WhatsApp session. WhatsApp cannot access XREAL WIN HUB APIs or files.',
      buttons: ['Allow', 'Block'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    };
    const prompt = mainWindow && !mainWindow.isDestroyed()
      ? dialog.showMessageBox(mainWindow, promptOptions)
      : dialog.showMessageBox(promptOptions);
    void prompt.then(({ response }) => {
      const approved = response === 0;
      if (approved) grantedWhatsAppPermissions.add(permission);
      callback(approved);
    }).catch(() => callback(false));
  });
  isolatedSession.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  return isolatedSession;
}

async function ensureWhatsAppView() {
  if (whatsappView && !whatsappView.webContents.isDestroyed()) return whatsappView;
  configureWhatsAppSession();
  whatsappView = new WebContentsView({
    webPreferences: {
      partition: WHATSAPP_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  configureWhatsAppContents(whatsappView.webContents);
  await whatsappView.webContents.loadURL(WHATSAPP_URL);
  return whatsappView;
}

function removeWhatsAppView() {
  if (!mainWindow || !whatsappView) return;
  try {
    mainWindow.contentView.removeChildView(whatsappView);
  } catch {
    // The view was already detached from the window.
  }
}

function validateWhatsAppBounds(value) {
  if (!value || typeof value !== 'object') return null;
  const numbers = ['x', 'y', 'width', 'height'].map((key) => Number(value[key]));
  if (!numbers.every(Number.isFinite)) return null;
  const [x, y, width, height] = numbers.map(Math.round);
  if (x < 0 || y < 0 || width < 320 || height < 360 || width > 10_000 || height > 10_000) return null;
  const contentBounds = mainWindow?.getContentBounds();
  if (!contentBounds || x + width > contentBounds.width + 2 || y + height > contentBounds.height + 2) return null;
  return { x, y, width, height };
}

async function setWhatsAppEmbedded(visible, bounds) {
  whatsappEmbeddedRequested = Boolean(visible);
  if (!visible || (whatsappWindow && !whatsappWindow.isDestroyed())) {
    removeWhatsAppView();
    return whatsappStatus();
  }
  const validated = validateWhatsAppBounds(bounds);
  if (!validated) throw new TypeError('Invalid WhatsApp view bounds.');
  whatsappBounds = validated;
  const view = await ensureWhatsAppView();
  if (!mainWindow || mainWindow.isDestroyed()) return whatsappStatus();
  removeWhatsAppView();
  mainWindow.contentView.addChildView(view);
  view.setBounds(validated);
  return whatsappStatus();
}

async function detachWhatsApp(alwaysOnTop) {
  await ensureWhatsAppView();
  if (whatsappWindow && !whatsappWindow.isDestroyed()) {
    whatsappWindow.focus();
    return whatsappStatus();
  }
  removeWhatsAppView();
  whatsappWindow = new BrowserWindow({
    title: 'WhatsApp — XREAL WIN HUB',
    width: 480,
    height: 720,
    minWidth: 380,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: Boolean(alwaysOnTop),
    backgroundColor: '#0b141a',
    webPreferences: {
      partition: WHATSAPP_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  configureWhatsAppContents(whatsappWindow.webContents);
  whatsappWindow.once('ready-to-show', () => whatsappWindow?.show());
  whatsappWindow.setContentProtection(true);
  whatsappWindow.on('closed', () => {
    whatsappWindow = null;
    publishWhatsAppStatus();
    if (whatsappEmbeddedRequested && whatsappBounds) {
      void setWhatsAppEmbedded(true, whatsappBounds).catch((error) =>
        console.error('Unable to restore embedded WhatsApp view', error),
      );
    }
  });
  await whatsappWindow.loadURL(WHATSAPP_URL);
  return publishWhatsAppStatus();
}

async function clearWhatsAppData() {
  whatsappEmbeddedRequested = false;
  removeWhatsAppView();
  if (whatsappWindow && !whatsappWindow.isDestroyed()) whatsappWindow.destroy();
  whatsappWindow = null;
  if (whatsappView && !whatsappView.webContents.isDestroyed()) whatsappView.webContents.close();
  whatsappView = null;
  whatsappState = 'idle';
  grantedWhatsAppPermissions.clear();
  grantedWhatsAppPermissions.add('clipboard-sanitized-write');
  const isolatedSession = session.fromPartition(WHATSAPP_PARTITION);
  await Promise.all([
    isolatedSession.clearStorageData(),
    isolatedSession.clearCache(),
    isolatedSession.clearAuthCache(),
  ]);
  await recordSecurityEvent('whatsapp:clear-data', 'allowed');
  return publishWhatsAppStatus('WhatsApp linked-session data was removed from this PC.');
}

function statePath() {
  return path.join(app.getPath('userData'), STATE_FILE);
}

function isSafeWebUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === 'https:'
      || (parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'));
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
      encryptedStorage: safeStorage.isEncryptionAvailable(),
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

async function verifyDisplayHelper() {
  const helperPath = displayHelperPath();
  const contents = await fs.readFile(helperPath);
  const digest = createHash('sha256').update(contents).digest('hex');
  if (digest !== DISPLAY_HELPER_SHA256) {
    await recordSecurityEvent('display:helper-integrity', 'blocked', digest);
    throw new Error('The Windows display helper failed its integrity check. Reinstall the Hub.');
  }
  return helperPath;
}

async function runDisplayHelper(action, payloadPath) {
  const helperPath = await verifyDisplayHelper();
  const args = [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', helperPath, '-Action', action,
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

  const helperPath = await verifyDisplayHelper();
  const watcher = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', helperPath, '-Action', 'Watch', '-PayloadPath', originalPath,
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

const MEDIA_VIRTUAL_KEYS = Object.freeze({
  previous: 0xB1,
  toggle: 0xB3,
  next: 0xB0,
  'volume-up': 0xAF,
  'volume-down': 0xAE,
});

async function sendMediaKey(command) {
  if (typeof command !== 'string' || !Object.hasOwn(MEDIA_VIRTUAL_KEYS, command)) return false;
  const keyCode = MEDIA_VIRTUAL_KEYS[command];
  if (process.platform !== 'win32') return false;
  const definition = [
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class HubMediaKey {',
    '[DllImport("user32.dll")] static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);',
    'public static void Tap(byte key) { keybd_event(key, 0, 0, UIntPtr.Zero); keybd_event(key, 0, 2, UIntPtr.Zero); }',
    '}',
  ].join(' ');
  try {
    await execFileAsync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      `Add-Type -TypeDefinition '${definition}'; [HubMediaKey]::Tap(${keyCode})`,
    ], { windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024 });
    return true;
  } catch (error) {
    console.error('Unable to send Windows media key', error);
    return false;
  }
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
    const saved = JSON.parse(contents);
    if (saved?.format !== 'safe-storage-v1') return saved;
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows secure storage is unavailable.');
    }
    if (typeof saved.payload !== 'string' || saved.payload.length > MAX_STATE_BYTES * 3) {
      throw new Error('Encrypted Hub state is invalid.');
    }
    return JSON.parse(safeStorage.decryptString(Buffer.from(saved.payload, 'base64')));
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

  const plainText = JSON.stringify(state);
  if (Buffer.byteLength(plainText, 'utf8') > MAX_STATE_BYTES) {
    throw new RangeError('Hub state exceeds the 2 MB local limit.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is unavailable; Hub data was not written unencrypted.');
  }
  const serialised = JSON.stringify({
    format: 'safe-storage-v1',
    payload: safeStorage.encryptString(plainText).toString('base64'),
  });

  const destination = statePath();
  const temporary = `${destination}.tmp`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(temporary, serialised, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, destination);
  return true;
}

async function clearLocalData() {
  await spotifyAuth.disconnect();
  await mainWindow?.webContents.session.clearStorageData({ storages: ['localstorage', 'indexdb', 'cachestorage'] });
  await Promise.all([
    fs.rm(statePath(), { force: true }),
    fs.rm(path.join(app.getPath('userData'), 'spotify-auth.json'), { force: true }),
    fs.rm(path.join(app.getPath('userData'), 'security-events.log'), { force: true }),
    fs.rm(path.join(app.getPath('userData'), 'security-events.log.previous'), { force: true }),
  ]);
  return true;
}

function registerIpc() {
  registerTrustedHandler(channels.loadState, loadState);
  registerTrustedHandler(channels.saveState, (state) => saveState(state));
  registerTrustedHandler(channels.clearLocalData, clearLocalData);
  registerTrustedHandler(channels.snapshot, () => getSnapshot());
  registerTrustedHandler(channels.openExternal, async (url) => {
    if (!isSafeWebUrl(url)) return false;
    try {
      return await confirmAndOpenExternal(url);
    } catch (error) {
      console.error('Unable to open external URL', error);
      return false;
    }
  });
  registerTrustedHandler(channels.launchWorkspace, async (profile, displayId) => {
    const moved = displayId ? moveWindowToDisplay(displayId) : false;
    const targets = Array.isArray(profile?.targets) ? profile.targets : [];
    let opened = 0;
    for (const target of targets.slice(0, 8)) {
      if (isSafeWebUrl(target?.url)) {
        try {
          if (await confirmAndOpenExternal(target.url)) opened += 1;
        } catch (error) {
          console.error('Unable to open workspace target', error);
        }
      }
    }
    return { opened, moved };
  });
  registerTrustedHandler(channels.moveToDisplay, (displayId) =>
    moveWindowToDisplay(displayId),
  );
  registerTrustedHandler(channels.theatreMode, (enabled, displayId) => {
    if (!mainWindow) return false;
    if (enabled && displayId) moveWindowToDisplay(displayId);
    mainWindow.setFullScreen(Boolean(enabled));
    return true;
  });
  registerTrustedHandler(channels.alwaysOnTop, (enabled) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(Boolean(enabled), 'floating');
    return mainWindow.isAlwaysOnTop();
  });
  registerTrustedHandler(channels.loginItem, (enabled) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    return app.getLoginItemSettings().openAtLogin;
  });
  registerTrustedHandler(channels.simulationMode, (enabled) => {
    simulationEnabled = Boolean(enabled);
    simulatedLayoutOverride = null;
    pendingDisplayTransaction = null;
    const snapshot = getSnapshot();
    sendSnapshot();
    return snapshot;
  });
  registerTrustedHandler(channels.displayLayout, getDisplayLayout);
  registerTrustedHandler(channels.displayPreview, (displays) => previewDisplayLayout(displays));
  registerTrustedHandler(channels.displayConfirm, confirmDisplayLayout);
  registerTrustedHandler(channels.displayRevert, revertDisplayLayout);
  registerTrustedHandler(channels.displayIdentify, identifyDisplays);
  registerTrustedHandler(channels.mediaKey, (command) => sendMediaKey(command));
  registerTrustedHandler(channels.spotifyStatus, () => spotifyAuth.getStatus());
  registerTrustedHandler(channels.spotifyConnect, (clientId) => spotifyAuth.connect(clientId));
  registerTrustedHandler(channels.spotifyDisconnect, () => spotifyAuth.disconnect());
  registerTrustedHandler(channels.spotifyPlay, (source) => spotifyAuth.playSource(source));
  registerTrustedHandler(channels.spotifyPlaybackStatus, () => spotifyAuth.playbackStatus());
  registerTrustedHandler(channels.spotifyControl, (command, value) => spotifyAuth.control(command, value));
  registerTrustedHandler(channels.whatsappStatus, () => whatsappStatus());
  registerTrustedHandler(channels.whatsappEmbedded, (visible, bounds) =>
    setWhatsAppEmbedded(visible, bounds),
  );
  registerTrustedHandler(channels.whatsappReload, async () => {
    const contents = whatsappWindow && !whatsappWindow.isDestroyed()
      ? whatsappWindow.webContents
      : (await ensureWhatsAppView()).webContents;
    contents.reload();
    return whatsappStatus();
  });
  registerTrustedHandler(channels.whatsappNavigate, async (direction) => {
    if (direction !== 'back' && direction !== 'forward') throw new TypeError('Invalid navigation direction.');
    const contents = whatsappWindow && !whatsappWindow.isDestroyed()
      ? whatsappWindow.webContents
      : (await ensureWhatsAppView()).webContents;
    if (direction === 'back' && contents.canGoBack()) contents.goBack();
    if (direction === 'forward' && contents.canGoForward()) contents.goForward();
    return whatsappStatus();
  });
  registerTrustedHandler(channels.whatsappDetach, (alwaysOnTop) => {
    return detachWhatsApp(Boolean(alwaysOnTop));
  });
  registerTrustedHandler(channels.whatsappAlwaysOnTop, (enabled) => {
    if (!whatsappWindow || whatsappWindow.isDestroyed()) return false;
    whatsappWindow.setAlwaysOnTop(Boolean(enabled), 'floating');
    return whatsappWindow.isAlwaysOnTop();
  });
  registerTrustedHandler(channels.whatsappClearData, clearWhatsAppData);
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
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeWebUrl(url)) void confirmAndOpenExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (url !== current) {
      event.preventDefault();
      if (isSafeWebUrl(url)) void confirmAndOpenExternal(url);
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited unexpectedly', details);
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    if (whatsappWindow && !whatsappWindow.isDestroyed()) whatsappWindow.destroy();
    if (whatsappView && !whatsappView.webContents.isDestroyed()) whatsappView.webContents.close();
    whatsappWindow = null;
    whatsappView = null;
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
  powerMonitor.on('lock-screen', () => hideWhatsAppForPrivacy('workstation-lock'));
  globalShortcut.register('CommandOrControl+Alt+Shift+H', () => hideWhatsAppForPrivacy('privacy-shortcut'));
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

app.on('will-quit', () => globalShortcut.unregisterAll());
