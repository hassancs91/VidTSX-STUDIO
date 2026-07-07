const { spawn } = require('child_process');
const path = require('path');

// Remove ELECTRON_RUN_AS_NODE to allow Electron to run properly
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronVite = path.join(__dirname, '..', 'node_modules', '.bin', 'electron-vite.cmd');

const child = spawn(electronVite, ['dev'], {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
  shell: true
});

child.on('exit', (code) => process.exit(code || 0));
