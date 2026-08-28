// Opens the bench harness in the SAME Chromium build the app ships.
//
// This is the whole reason the harness is not just a page in Chrome: decoder
// behaviour, WebCodecs support and hardware-decode paths are properties of the
// bundled Chromium. Measuring a different browser would produce numbers that
// do not transfer to the product.
//
// Launched by run-bench.mjs; not meant to be run by hand.

const { app, BrowserWindow } = require('electron');

const url = process.env.BENCH_URL;
if (!url) {
  console.error('[bench-host] BENCH_URL is required');
  process.exit(1);
}

// Occlusion tracking marks a fully-covered window hidden, Chromium stops
// producing frames, and every rAF reading collapses to a meaningless ~0 while
// the driver keeps "working". The harness refuses to measure in that state;
// these switches stop it happening in the first place.
// (docs/ui-automation-cdp.md records two sessions lost to exactly this.)
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: true,
    backgroundColor: '#101317',
    title: 'VidTSX preview bench',
    webPreferences: {
      // No preload, no node integration: the harness is a plain web page and
      // must stay one, so what it measures is what the renderer process does.
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.loadURL(url);
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.webContents.on('render-process-gone', (_e, details) => {
    console.error(`[bench-host] renderer gone: ${details.reason}`);
    app.exit(3);
  });
});

app.on('window-all-closed', () => app.quit());
