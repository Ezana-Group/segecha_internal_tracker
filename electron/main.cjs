const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const { Client } = require('pg');
const http = require('http');

let mainWindow = null;
let serverProcess = null;
const userDataPath = app.getPath('userData');
const envFilePath = path.join(userDataPath, '.env');

// Clean up child process on exit
app.on('will-quit', () => {
  stopServer();
});

function stopServer() {
  if (serverProcess) {
    console.log('[Electron] Stopping backend server process...');
    serverProcess.kill();
    serverProcess = null;
  }
}

// Read configuration from the user's .env file
function loadConfig() {
  const config = {
    DATABASE_URL: process.env.DATABASE_URL || '',
    ADMIN_KEY: process.env.ADMIN_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || 'segecha-jwt-secret-local-dev-default',
    COMPANY_NAME: process.env.COMPANY_NAME || 'Segecha Group Ltd',
    INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || 'admin@segecha.com',
    INITIAL_ADMIN_PHONE: process.env.INITIAL_ADMIN_PHONE || '+254700000000',
    PORT: '3001'
  };

  if (fs.existsSync(envFilePath)) {
    const content = fs.readFileSync(envFilePath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key && !key.startsWith('#')) {
          config[key] = val;
        }
      }
    });
  } else {
    // If user's local .env doesn't exist, initialize with defaults
    config.DATABASE_URL = 'postgresql://neondb_owner:npg_TYEaMSw7I1Gm@ep-wandering-hall-abj6izc4-pooler.eu-west-2.aws.neon.tech/segecha-db?sslmode=require&channel_binding=require';
    config.ADMIN_KEY = 'SierraGolf26';
    config.INITIAL_ADMIN_EMAIL = 'admin@segecha.com';
    config.INITIAL_ADMIN_PHONE = '+254700000000';
    config.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
    saveConfig(config);
  }
  return config;
}

// Write config to the user's .env file
function saveConfig(config) {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  let content = '# Segecha Internal Tracker Local Portable App Environment Configuration\n';
  Object.keys(config).forEach(key => {
    content += `${key}=${config[key]}\n`;
  });
  
  fs.writeFileSync(envFilePath, content, 'utf8');
  console.log(`[Electron] Configuration saved to: ${envFilePath}`);
}

// Test PostgreSQL connection
async function testConnection(dbUrl) {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // standard local/Neon development ssl configuration
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return { success: true };
  } catch (err) {
    console.error('[Electron] Database connection test failed:', err.message);
    return { success: false, error: err.message };
  }
}

// Launch setup window
function showSetupWindow() {
  stopServer();
  
  if (mainWindow) {
    mainWindow.close();
  }

  mainWindow = new BrowserWindow({
    width: 650,
    height: 750,
    resizable: false,
    frame: true,
    title: 'Segecha Tracker Setup Wizard',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'setup.html'));
  
  // Remove default menu in setup
  mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Check if server is running and healthy
function checkServerHealth(url, retries = 30, delay = 1000) {
  return new Promise((resolve) => {
    const attempt = (remaining) => {
      if (remaining <= 0) {
        resolve(false);
        return;
      }
      
      http.get(`${url}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          setTimeout(() => attempt(remaining - 1), delay);
        }
      }).on('error', () => {
        setTimeout(() => attempt(remaining - 1), delay);
      });
    };
    attempt(retries);
  });
}

// Start backend Express server as child process
async function startServerAndLaunch() {
  const config = loadConfig();
  
  if (!config.DATABASE_URL || !config.ADMIN_KEY) {
    console.log('[Electron] Missing configuration. Redirecting to setup wizard.');
    showSetupWindow();
    return;
  }

  // Double check if database connection actually works to prevent app crashes on stale credentials
  const dbTest = await testConnection(config.DATABASE_URL);
  if (!dbTest.success) {
    console.log('[Electron] Database URL invalid or unreachable. Loading Setup Wizard.');
    showSetupWindow();
    return;
  }

  console.log('[Electron] Starting backend server...');
  
  // Backups dir in the writable user data directory
  const backupsDir = path.join(userDataPath, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Setup env variables to pass to child process
  const childEnv = {
    ...process.env,
    ...config,
    SEGECHA_BACKUPS_DIR: backupsDir,
    NODE_ENV: 'production',
    PORT: '3001',
    // Sync all portals paths by overriding static configuration
    TRACKER_URL: 'http://localhost:3001',
    PORTAL_URL: 'http://localhost:3001/pay',
    DRIVER_PORTAL_URL: 'http://localhost:3001/driver',
    TRACK_PORTAL_URL: 'http://localhost:3001/track'
  };

  // Fork index.js
  const serverScript = path.join(__dirname, '../server/index.js');
  
  serverProcess = fork(serverScript, [], {
    env: childEnv,
    silent: true
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`[Electron] Server exited with code ${code}`);
    if (code !== 0 && code !== null) {
      // If server crashed, take user back to setup wizard
      showSetupWindow();
    }
  });

  // Wait for health check
  const healthy = await checkServerHealth('http://localhost:3001');
  if (!healthy) {
    console.error('[Electron] Server health check timed out. Spawning Setup Screen.');
    showSetupWindow();
    return;
  }

  launchMainWindow();
}

function launchMainWindow() {
  if (mainWindow) {
    mainWindow.close();
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Segecha Internal Tracker',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the admin panel running on the local express server
  mainWindow.loadURL('http://localhost:3001');

  // Handle external link clicks (like WhatsApp links, email previews, etc.) in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('http://localhost:3001')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

// IPC Channel Handlers
ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('test-db', async (event, dbUrl) => {
  return await testConnection(dbUrl);
});

ipcMain.handle('save-config', async (event, config) => {
  // Validate credentials first
  const dbTest = await testConnection(config.DATABASE_URL);
  if (!dbTest.success) {
    return { success: false, error: `Database Connection Failed: ${dbTest.error}` };
  }

  // Ensure JWT secret is set
  if (!config.JWT_SECRET) {
    config.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
  }

  try {
    saveConfig(config);
    // Restart backend server with new configuration
    startServerAndLaunch();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App ready handler
app.whenReady().then(() => {
  startServerAndLaunch();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      startServerAndLaunch();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
