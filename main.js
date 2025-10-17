const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let win;
let botProcess;

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  win.on('closed', () => {
    if (botProcess) botProcess.kill();
    win = null;
  });
}

app.whenReady().then(createWindow);

ipcMain.on('start-bot', () => {
  if (botProcess) return;

  botProcess = fork(path.join(__dirname, 'bot.js'));

  botProcess.on('message', msg => {
    if (win) win.webContents.send('bot-log', msg);
  });

  botProcess.on('exit', () => {
    botProcess = null;
    if (win) win.webContents.send('bot-log', '🛑 Bot finalizado.');
  });
});

ipcMain.on('stop-bot', () => {
  if (botProcess) {
    botProcess.kill();
    botProcess = null;
    if (win) win.webContents.send('bot-log', '🛑 Bot parado.');
  }
});
