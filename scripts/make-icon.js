// Draws the app icon (a little treemap) and saves it as src/assets/icon.png (512x512).
// Run with: npm run icon
'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

function draw() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');

  // background tile
  const bg = x.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(1, '#0b1020');
  x.beginPath();
  x.roundRect(16, 16, 480, 480, 112);
  x.fillStyle = bg;
  x.fill();
  x.lineWidth = 4;
  x.strokeStyle = 'rgba(167,139,250,0.45)';
  x.stroke();

  const tile = (tx, ty, tw, th, c1, c2, stripes) => {
    x.save();
    x.beginPath();
    x.roundRect(tx, ty, tw, th, 30);
    const g = x.createLinearGradient(tx, ty, tx + tw * 0.4, ty + th);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    x.fillStyle = g;
    x.fill();
    x.clip();
    const gl = x.createLinearGradient(tx, ty, tx, ty + th * 0.5);
    gl.addColorStop(0, 'rgba(255,255,255,0.35)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gl;
    x.fillRect(tx, ty, tw, th);
    if (stripes) {
      x.strokeStyle = 'rgba(255,255,255,0.18)';
      x.lineWidth = 18;
      x.beginPath();
      for (let s = -th; s < tw; s += 52) { x.moveTo(tx + s, ty + th); x.lineTo(tx + s + th, ty); }
      x.stroke();
    }
    x.restore();
  };

  tile(64, 64, 220, 384, '#fdba74', '#ea580c', true);
  tile(300, 64, 148, 196, '#5eead4', '#0d9488');
  tile(300, 276, 148, 80, '#c4b5fd', '#7c3aed');
  tile(300, 372, 66, 76, '#f9a8d4', '#db2777');
  tile(382, 372, 66, 76, '#7dd3fc', '#0284c7');

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
