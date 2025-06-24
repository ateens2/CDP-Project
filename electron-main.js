const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// 백엔드 서버 시작
function startBackendServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'backend', 'app.js');
    serverProcess = spawn('node', [serverPath], {
      stdio: 'pipe',
      cwd: path.join(__dirname, 'backend')
    });

    serverProcess.stdout.on('data', (data) => {
      console.log('Server:', data.toString());
      if (data.toString().includes('Server is running on port 3000')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server Error:', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      reject(error);
    });

    // 3초 후에도 응답이 없으면 타임아웃
    setTimeout(() => {
      resolve(); // 일단 진행
    }, 3000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'frontend', 'dist', 'Logo.png'),
    title: 'CDP 프로젝트'
  });

  // 로딩 페이지 표시
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));

  // 서버 시작 후 메인 페이지 로드
  startBackendServer()
    .then(() => {
      setTimeout(() => {
        mainWindow.loadURL('http://localhost:3000');
      }, 2000);
    })
    .catch((error) => {
      dialog.showErrorBox('서버 시작 실패', `백엔드 서버를 시작할 수 없습니다: ${error.message}`);
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // 서버 프로세스 종료
  if (serverProcess) {
    serverProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 앱 종료 시 정리
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
}); 