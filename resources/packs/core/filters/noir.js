// ../../../vidtsx-addons/filters/dist/sdk/core/canvas.js
function base(f, filter2 = "none") {
  f.ctx.filter = filter2;
  f.ctx.drawImage(f.source, 0, 0);
  f.ctx.filter = "none";
}

// ../../../vidtsx-addons/filters/dist/sdk/core/color.js
function noir(f) {
  base(f, "grayscale(1) contrast(1.28)");
  const g = f.ctx.createRadialGradient(f.width / 2, f.height * 0.42, f.width * 0.18, f.width / 2, f.height / 2, f.width * 0.72);
  g.addColorStop(0, "transparent");
  g.addColorStop(1, "#000b");
  f.ctx.fillStyle = g;
  f.ctx.fillRect(0, 0, f.width, f.height);
}

// ../../../vidtsx-addons/filters/dist/sdk/noir/index.js
var filter = {
  ...{
    id: "noir",
    name: "Noir",
    tier: "common",
    tagline: "Main character energy.",
    description: "A punchy monochrome grade with soft cinematic edge shading.",
    accent: "#bbc0ca",
    symbol: "\u25D0",
    faceTracking: false,
    animated: false,
    defaultIntensity: 1
  },
  render: noir
};

// <stdin>
var stdin_default = filter;
export {
  stdin_default as default
};
