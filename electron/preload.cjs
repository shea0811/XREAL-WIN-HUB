'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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
  audioSnapshot: 'audio:snapshot',
  audioMaster: 'audio:master',
  audioSession: 'audio:session',
  spotifyStatus: 'spotify:status',
  spotifyConnect: 'spotify:connect',
  spotifyDisconnect: 'spotify:disconnect',
  spotifyPlay: 'spotify:play',
  spotifyPlaybackStatus: 'spotify:playback-status',
  spotifyDevices: 'spotify:devices',
  spotifySelectDevice: 'spotify:select-device',
  spotifyControl: 'spotify:control',
  spotifyCatalog: 'spotify:catalog',
  whatsappStatus: 'whatsapp:status',
  whatsappStatusChanged: 'whatsapp:status-changed',
  whatsappEmbedded: 'whatsapp:embedded',
  whatsappReload: 'whatsapp:reload',
  whatsappNavigate: 'whatsapp:navigate',
  whatsappDetach: 'whatsapp:detach',
  whatsappAlwaysOnTop: 'whatsapp:always-on-top',
  whatsappClearData: 'whatsapp:clear-data',
  discordStatus: 'discord:status',
  discordStatusChanged: 'discord:status-changed',
  discordEmbedded: 'discord:embedded',
  discordReload: 'discord:reload',
  discordNavigate: 'discord:navigate',
  discordDetach: 'discord:detach',
  discordAlwaysOnTop: 'discord:always-on-top',
  discordClearData: 'discord:clear-data',
});

contextBridge.exposeInMainWorld('xrealHub', {
  loadState: () => ipcRenderer.invoke(channels.loadState),
  saveState: (state) => ipcRenderer.invoke(channels.saveState, state),
  clearLocalData: () => ipcRenderer.invoke(channels.clearLocalData),
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
  getAudioSnapshot: () => ipcRenderer.invoke(channels.audioSnapshot),
  setMasterVolume: (volume) => ipcRenderer.invoke(channels.audioMaster, volume),
  setAudioSessionVolume: (sessionKey, volume) => ipcRenderer.invoke(channels.audioSession, sessionKey, volume),
  getSpotifyAuthStatus: () => ipcRenderer.invoke(channels.spotifyStatus),
  connectSpotify: (clientId) => ipcRenderer.invoke(channels.spotifyConnect, clientId),
  disconnectSpotify: () => ipcRenderer.invoke(channels.spotifyDisconnect),
  playSpotifySource: (source) => ipcRenderer.invoke(channels.spotifyPlay, source),
  getSpotifyPlaybackStatus: () => ipcRenderer.invoke(channels.spotifyPlaybackStatus),
  getSpotifyDevices: () => ipcRenderer.invoke(channels.spotifyDevices),
  setSpotifyDevice: (deviceId) => ipcRenderer.invoke(channels.spotifySelectDevice, deviceId),
  controlSpotify: (command, value) => ipcRenderer.invoke(channels.spotifyControl, command, value),
  getSpotifyCatalog: (action, payload) => ipcRenderer.invoke(channels.spotifyCatalog, action, payload),
  getWhatsAppStatus: () => ipcRenderer.invoke(channels.whatsappStatus),
  setWhatsAppEmbedded: (visible, bounds) =>
    ipcRenderer.invoke(channels.whatsappEmbedded, visible, bounds),
  reloadWhatsApp: () => ipcRenderer.invoke(channels.whatsappReload),
  navigateWhatsApp: (direction) => ipcRenderer.invoke(channels.whatsappNavigate, direction),
  detachWhatsApp: (alwaysOnTop) => ipcRenderer.invoke(channels.whatsappDetach, alwaysOnTop),
  setWhatsAppAlwaysOnTop: (enabled) => ipcRenderer.invoke(channels.whatsappAlwaysOnTop, enabled),
  clearWhatsAppData: () => ipcRenderer.invoke(channels.whatsappClearData),
  onWhatsAppStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on(channels.whatsappStatusChanged, listener);
    return () => ipcRenderer.removeListener(channels.whatsappStatusChanged, listener);
  },
  getDiscordStatus: () => ipcRenderer.invoke(channels.discordStatus),
  setDiscordEmbedded: (visible, bounds) => ipcRenderer.invoke(channels.discordEmbedded, visible, bounds),
  reloadDiscord: () => ipcRenderer.invoke(channels.discordReload),
  navigateDiscord: (direction) => ipcRenderer.invoke(channels.discordNavigate, direction),
  detachDiscord: (alwaysOnTop) => ipcRenderer.invoke(channels.discordDetach, alwaysOnTop),
  setDiscordAlwaysOnTop: (enabled) => ipcRenderer.invoke(channels.discordAlwaysOnTop, enabled),
  clearDiscordData: () => ipcRenderer.invoke(channels.discordClearData),
  onDiscordStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on(channels.discordStatusChanged, listener);
    return () => ipcRenderer.removeListener(channels.discordStatusChanged, listener);
  },
  onSystemSnapshot: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on(channels.snapshotChanged, listener);
    return () => ipcRenderer.removeListener(channels.snapshotChanged, listener);
  },
});
