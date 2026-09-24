// ../../../vidtsx-addons/filters/dist/sdk/core/canvas.js
function context(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx)
    throw new Error("A Canvas 2D context is required.");
  return ctx;
}

// ../../../vidtsx-addons/filters/dist/sdk/core/highlights.js
function highlightBloom(frame, threshold, radius, warmth) {
  const scale = Math.min(1, 640 / Math.max(frame.width, frame.height));
  const w = Math.max(1, Math.round(frame.width * scale));
  const h = Math.max(1, Math.round(frame.height * scale));
  const highlights = frame.buffer("highlights", w, h), extraction = context(highlights);
  extraction.clearRect(0, 0, w, h);
  extraction.drawImage(frame.source, 0, 0, w, h);
  const pixels = extraction.getImageData(0, 0, w, h), data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const t = Math.max(0, Math.min(1, (luminance - threshold) / Math.max(1e-3, Math.min(0.15, 1 - threshold))));
    const gain = t * t * (3 - 2 * t) * data[i + 3] / 255;
    data[i] *= gain * (1 - Math.max(0, -warmth) * 0.35);
    data[i + 1] *= gain * (1 - Math.abs(warmth) * 0.12);
    data[i + 2] *= gain * (1 - Math.max(0, warmth) * 0.55);
    data[i + 3] = 255;
  }
  extraction.putImageData(pixels, 0, 0);
  const glow = frame.buffer("highlight-glow", w, h), ctx = context(glow);
  const sigma = Math.min(w, h) * radius / 100;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.65;
  ctx.filter = `blur(${sigma * 0.3}px)`;
  ctx.drawImage(highlights, 0, 0);
  ctx.globalAlpha = 0.35;
  ctx.filter = `blur(${sigma}px)`;
  ctx.drawImage(highlights, 0, 0);
  ctx.restore();
  return glow;
}

// ../../../vidtsx-addons/filters/dist/sdk/cinematic-bloom/index.js
var filter = {
  id: "cinematic-bloom",
  name: "Cinematic Bloom",
  tier: "intermediate",
  tagline: "Let the highlights linger.",
  description: "Soft light spills from bright lamps and reflections, with warm diffusion and clear, contrasting shadows.",
  accent: "#e8bc83",
  symbol: "\u263C",
  faceTracking: false,
  subjectTracking: false,
  animated: false,
  defaultIntensity: 1,
  parameters: [
    { key: "threshold", label: "Highlight threshold", type: "range", min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: "radius", label: "Bloom radius", type: "range", min: 0.25, max: 8, step: 0.05, default: 2.5, unit: "%" },
    { key: "warmth", label: "Warmth", type: "range", min: -1, max: 1, step: 0.05, default: 0.2 },
    { key: "strength", label: "Bloom strength", type: "range", min: 0, max: 1, step: 0.05, default: 0.75 }
  ],
  presets: [
    { id: "neutral-glass", name: "Neutral Glass", parameters: { threshold: 0.65, radius: 2.5, warmth: 0.2, strength: 0.75 } },
    { id: "golden-diffusion", name: "Golden Diffusion", parameters: { threshold: 0.55, radius: 4, warmth: 0.8, strength: 0.85 } },
    { id: "dreamlight", name: "Dreamlight", parameters: { threshold: 0.4, radius: 6, warmth: -0.15, strength: 1 } }
  ],
  render(frame) {
    const { ctx, source, width, height, parameters: p } = frame;
    ctx.drawImage(source, 0, 0);
    if (Number(p.strength) === 0 || Number(p.threshold) === 1)
      return;
    const glow = highlightBloom(frame, Number(p.threshold), Number(p.radius), Number(p.warmth));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = Number(p.strength);
    ctx.drawImage(glow, 0, 0, width, height);
    ctx.restore();
  }
};

// <stdin>
var stdin_default = filter;
export {
  stdin_default as default
};
