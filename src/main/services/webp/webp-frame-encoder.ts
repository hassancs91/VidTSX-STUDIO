import { BrowserWindow } from 'electron';

/**
 * PNG → WebP frame encoder backed by a hidden BrowserWindow.
 *
 * Neither Remotion's stripped ffmpeg nor Electron's nativeImage can encode
 * WebP — but Chromium's canvas encoder can (it's the same libwebp Chrome
 * uses, including alpha, and quality 1.0 switches it to lossless VP8L). So
 * frames round-trip through a hidden page: PNG in as a data URL, WebP bytes
 * back as base64 via executeJavaScript's promise support. Same hidden-window
 * pattern as tone-audio-extractor.
 *
 * Frames are encoded one at a time by design — the caller streams them
 * through, so peak memory stays at a single decoded frame.
 */
export interface WebpFrameEncoder {
  /** Encode one PNG frame. Returns a complete single-image .webp file. */
  encode(png: Buffer): Promise<Buffer>;
  destroy(): void;
}

const ENCODER_PAGE = `<!doctype html><script>
  let canvas = null;
  let ctx = null;
  window.__encodeFrame = (pngBase64, fillColor, quality) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        if (!canvas) {
          canvas = document.createElement('canvas');
          ctx = canvas.getContext('2d');
        }
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (fillColor) {
          ctx.fillStyle = fillColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('canvas.toBlob returned null'));
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('Failed to read encoded blob'));
          reader.readAsDataURL(blob);
        }, 'image/webp', quality);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to decode PNG frame'));
    img.src = 'data:image/png;base64,' + pngBase64;
  });
</script>`;

export interface WebpFrameEncoderOptions {
  /**
   * 0–1 canvas encoder quality. Exactly 1 selects Chromium's lossless WebP
   * (VP8L); below 1 is lossy VP8.
   */
  quality: number;
  /**
   * CSS color painted under each frame, or null to keep the PNG's alpha
   * channel (transparent output). White matches what opaque video codecs
   * show for compositions that don't paint their own background.
   */
  fillColor: string | null;
}

export async function createWebpFrameEncoder(
  options: WebpFrameEncoderOptions
): Promise<WebpFrameEncoder> {
  const win = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Hidden windows throttle timers/RAF; encoding uses neither, but the
      // flag keeps decode/encode callbacks from being deprioritized.
      backgroundThrottling: false,
    },
  });

  let destroyed = false;

  try {
    await win.loadURL(
      'data:text/html;base64,' + Buffer.from(ENCODER_PAGE, 'utf-8').toString('base64')
    );
  } catch (err) {
    win.destroy();
    throw err;
  }

  const quality = Math.min(Math.max(options.quality, 0.01), 1);

  return {
    async encode(png: Buffer): Promise<Buffer> {
      if (destroyed || win.isDestroyed()) {
        throw new Error('WebP frame encoder is destroyed');
      }
      const base64: string = await win.webContents.executeJavaScript(
        `window.__encodeFrame(${JSON.stringify(png.toString('base64'))}, ${JSON.stringify(
          options.fillColor
        )}, ${quality})`,
        true
      );
      if (typeof base64 !== 'string' || base64.length === 0) {
        throw new Error('WebP frame encoder returned no data');
      }
      return Buffer.from(base64, 'base64');
    },
    destroy(): void {
      destroyed = true;
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
