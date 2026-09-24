// ../../../vidtsx-addons/filters/dist/sdk/core/canvas.js
function base(f, filter2 = "none") {
  f.ctx.filter = filter2;
  f.ctx.drawImage(f.source, 0, 0);
  f.ctx.filter = "none";
}

// ../../../vidtsx-addons/filters/dist/sdk/core/stylized.js
function vhs(f) {
  base(f, "saturate(.72) contrast(1.12)");
  const tick = Math.floor(f.time * 18), { ctx, width: w, height: h } = f;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.19;
  ctx.drawImage(f.source, 4 * Math.sin(tick), 0);
  ctx.restore();
  const y = f.time * 0.16 % 1 * h;
  ctx.drawImage(f.source, 0, Math.max(0, y), w, Math.min(h - y, 12), Math.sin(tick) * 14, y, w, Math.min(h - y, 12));
  ctx.fillStyle = "#09163225";
  for (let row = 0; row < h; row += 4)
    ctx.fillRect(0, row, w, 1);
  let seed = (tick + 1) * 7919;
  for (let i = 0; i < 360; i++) {
    seed = seed * 1664525 + 1013904223 >>> 0;
    const x = seed % w;
    seed = seed * 1664525 + 1013904223 >>> 0;
    ctx.fillStyle = i % 2 ? "#fff3" : "#0003";
    ctx.fillRect(x, seed % h, 2, 1);
  }
  ctx.font = `600 ${w * 0.025}px monospace`;
  ctx.fillStyle = "#faffed";
  ctx.fillText("PLAY  \u25B6", w * 0.05, h * 0.09);
  ctx.fillText(`00:00:${String(Math.floor(f.time) % 60).padStart(2, "0")}`, w * 0.69, h * 0.92);
}

// ../../../vidtsx-addons/filters/dist/sdk/vhs/index.js
var filter = {
  ...{
    id: "vhs",
    name: "VHS Club",
    tier: "intermediate",
    tagline: "Be kind. Rewind.",
    description: "Moving scan lines, tape interference, color ghosting, and a retro timestamp.",
    accent: "#cfb3df",
    symbol: "\u25A4",
    faceTracking: false,
    animated: true,
    defaultIntensity: 0.85
  },
  render: vhs
};

// <stdin>
var stdin_default = filter;
export {
  stdin_default as default
};
