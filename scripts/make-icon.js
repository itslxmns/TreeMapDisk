// Draws the app icon (a little treemap) and saves it as src/assets/icon.png (512x512).
// Run with: npm run icon
'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function draw() {
  // Flat mark: a graphite tile holding a small treemap, one block taped off as clutter.
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');

  x.beginPath();
  x.roundRect(16, 16, 480, 480, 112);
  x.fillStyle = '#1b1b1d';
  x.fill();
  x.lineWidth = 4;
  x.strokeStyle = 'rgba(237,237,237,0.12)';
  x.stroke();

  const block = (bx, by, bw, bh, color, tape) => {
    x.save();
    x.beginPath();
    x.roundRect(bx, by, bw, bh, 28);
    x.fillStyle = color;
    x.fill();
    if (tape) {
      x.clip();
      x.strokeStyle = 'rgba(26,13,5,0.22)';
      x.lineWidth = 30;
      x.beginPath();
      for (let s = -bh; s < bw; s += 78) { x.moveTo(bx + s, by + bh); x.lineTo(bx + s + bh, by); }
      x.stroke();
    }
    x.restore();
  };

  block(80, 80, 208, 352, '#ee6c2b', true);
  block(304, 80, 128, 184, '#8e9199');
  block(304, 280, 128, 72, '#5f626a');
  block(304, 368, 56, 64, '#46484e');
  block(376, 368, 56, 64, '#6e727b');

  return c.toDataURL('image/png');
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<html><body></body></html>');
  const dataUrl = await win.webContents.executeJavaScript(`(${draw.toString()})()`);
  const out = path.join(__dirname, '..', 'src', 'assets', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`Saved ${out}`);
  app.quit();
});
