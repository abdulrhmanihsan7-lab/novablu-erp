const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

const smokeMode = process.argv.includes('--smoke-test');
let mainWindow = null;

if (smokeMode) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f5f7fb',
    title: 'NovaBlu ERP 0.15',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  const smokeTimeout = smokeMode ? setTimeout(() => app.exit(3), 20000) : null;

  mainWindow.webContents.once('did-finish-load', async () => {
    if (!smokeMode) return;
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const raw = localStorage.getItem('novablu_erp_v1_free');
          let db = null;
          try { db = raw ? JSON.parse(raw) : null; } catch {}
          return {
            title: document.title,
            body: document.body?.innerText?.slice(0, 500) || '',
            schemaVersion: Number(db?.meta?.version || 0),
            hasCompany: Array.isArray(db?.companies) && db.companies.length > 0,
            hasProducts: Array.isArray(db?.products)
          };
        })()
      `);
      if (smokeTimeout) clearTimeout(smokeTimeout);
      const ok =
        /NovaBlu ERP/.test(result.title) &&
        result.schemaVersion >= 15 &&
        result.hasCompany &&
        result.hasProducts;
      app.exit(ok ? 0 : 2);
    } catch {
      if (smokeTimeout) clearTimeout(smokeTimeout);
      app.exit(2);
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (smokeMode) return;
    mainWindow.show();
    if (process.argv.includes('--start-maximized')) mainWindow.maximize();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('ai.novablu.erp');

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['notifications', 'clipboard-read', 'clipboard-sanitized-write'].includes(permission));
  });

  createWindow();

  app.on('activate', () => {
    if (!smokeMode && BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || smokeMode) app.quit();
});
