'use strict';
/**
 * VSENDER Live Chat — Windows shell.
 * A thin window around the hosted page (APP_ORIGIN + START_PATH). No customer data or keys live
 * here; sign-in, access checks and every API call happen on the website's server.
 * Safety: no Node access in the page, only our own site may load in the window, other links go to
 * the default browser (https only), only notification/location/microphone permissions are granted.
 */
const { app, BrowserWindow, Menu, Tray, shell, session, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { APP_ORIGIN, START_PATH } = require('./app-config');

const START_URL = APP_ORIGIN + START_PATH;
const ALLOWED_PERMISSIONS = new Set(['notifications', 'geolocation', 'media', 'clipboard-sanitized-write']);

let win = null;
let tray = null;
let quitting = false;

app.setAppUserModelId('in.vsender.livechat'); // needed for Windows notifications

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on('second-instance', () => showWindow());

function isOurs(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openExternal(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' || u.protocol === 'tel:')
      shell.openExternal(url);
  } catch {
    /* ignore malformed links */
  }
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function offlineUrl() {
  return 'file://' + path.join(__dirname, 'offline.html').replace(/\\/g, '/') + '?u=' + encodeURIComponent(START_URL);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'VSENDER Live Chat',
    icon: path.join(__dirname, 'build', 'tray.png'),
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  });
  win.removeMenu();
  win.loadURL(START_URL);

  // Our own site stays in the window; everything else opens in the browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return; // our offline page
    if (!isOurs(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  // No connection / server down: friendly page with automatic retry
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */ || url.startsWith('file:')) return;
    win.loadURL(offlineUrl());
  });

  // The close button hides to the tray so chats keep arriving; Quit is in the tray menu
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'tray.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('VSENDER Live Chat');
  const build = () =>
    Menu.buildFromTemplate([
      { label: 'Open VSENDER Live Chat', click: showWindow },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]);
  tray.setContextMenu(build());
  tray.on('click', showWindow);
}

function lockDownSession() {
  const ses = session.defaultSession;
  const allowed = (wc, permission) =>
    ALLOWED_PERMISSIONS.has(permission) && isOurs(wc ? wc.getURL() : '');
  ses.setPermissionRequestHandler((wc, permission, callback) => callback(allowed(wc, permission)));
  ses.setPermissionCheckHandler((wc, permission) => allowed(wc, permission));
}

function startUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    const check = () => autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
    check();
    setInterval(check, 6 * 60 * 60 * 1000);
  } catch {
    /* updates are optional: never stop the app because of them */
  }
}

app.on('web-contents-created', (_e, contents) => {
  // Never allow <webview> or extra permissions in embedded content
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

ipcMain.setMaxListeners(0);

app.whenReady().then(() => {
  lockDownSession();
  createWindow();
  createTray();
  startUpdates();
  app.on('activate', showWindow);
});

app.on('before-quit', () => {
  quitting = true;
});
// Keep running in the tray when all windows are hidden
app.on('window-all-closed', () => {});
