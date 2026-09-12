'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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
  mediaKey: 'media:key',
  spotifyStatus: 'spotify:status',
  spotifyConnect: 'spotify:connect',
  spotifyDisconnect: 'spotify:disconnect',
  spotifyToken: 'spotify:token',
  spotifyPlay: 'spotify:play',
});

contextBridge.exposeInMainWorld('xrealHub', {
  loadState: () => ipcRenderer.invoke(channels.loadState),
  saveState: (state) => ipcRenderer.invoke(channels.saveState, state),
  getSystemSnapshot: () => ipcRenderer.invoke(channels.snapshot),
  openExternal: (url) => ipcRenderer.invoke(channels.openExternal, url),
  launchWorkspace: (profile, displayId) =>
    ipcRenderer.invoke(channels.launchWorkspace, profile, displayId),
  moveToDisplay: (displayId) => ipcRenderer.invoke(channels.moveToDisplay, displayId),
  setTheatreMode: (enabled, displayId) =>
    ipcRenderer.invoke(channels.theatreMode, enabled, displayId),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke(channels.alwaysOnTop, enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke(channels.loginItem, enabled),
  setSimulationMode: (enabled) => ipcRenderer.invoke(channels.simulationMode, enabled),
  getDisplayLayout: () => ipcRenderer.invoke(channels.displayLayout),
  previewDisplayLayout: (displays) => ipcRenderer.invoke(channels.displayPreview, displays),
  confirmDisplayLayout: () => ipcRenderer.invoke(channels.displayConfirm),
  revertDisplayLayout: () => ipcRenderer.invoke(channels.displayRevert),
  identifyDisplays: () => ipcRenderer.invoke(channels.displayIdentify),
  sendMediaKey: (command) => ipcRenderer.invoke(channels.mediaKey, command),
  getSpotifyAuthStatus: () => ipcRenderer.invoke(channels.spotifyStatus),
  connectSpotify: (clientId) => ipcRenderer.invoke(channels.spotifyConnect, clientId),
  disconnectSpotify: () => ipcRenderer.invoke(channels.spotifyDisconnect),
  getSpotifyAccessToken: () => ipcRenderer.invoke(channels.spotifyToken),
  playSpotifySource: (source, deviceId) => ipcRenderer.invoke(channels.spotifyPlay, source, deviceId),
  onSystemSnapshot: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on(channels.snapshotChanged, listener);
    return () => ipcRenderer.removeListener(channels.snapshotChanged, listener);
  },
});
