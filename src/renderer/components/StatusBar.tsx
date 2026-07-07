import { useState, useEffect, useRef } from 'react';
import { createRendererLogger } from '../utils/logger';
import { useSystemMonitor } from '../hooks/useSystemMonitor';

const log = createRendererLogger('StatusBar');

// ─── Tiny inline sparkline (no axis, no labels) ──────────────────

function TinySparkline({
  data,
  max = 100,
  color,
  width = 48,
  height = 14,
}: {
  data: number[];
  max?: number;
  color: string;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Fill
    const stepX = width / (data.length - 1);
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < data.length; i++) {
      const y = height - (Math.min(data[i], max) / max) * (height - 1);
      ctx.lineTo(i * stepX, y);
    }
    ctx.lineTo((data.length - 1) * stepX, height);
    ctx.closePath();
    ctx.fillStyle = color + '20';
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const y = height - (Math.min(data[i], max) / max) * (height - 1);
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * stepX, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [data, max, color, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: 'block' }}
    />
  );
}

// ─── StatusBar ──────────���─────────────────────────────────────────

export function StatusBar() {
  const [version, setVersion] = useState<string>('');
  const { current, cpuHistory, ramHistory, appRamHistory, gpuHistory } = useSystemMonitor();

  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const info = await window.api.appGetInfo();
        setVersion(info.version);
      } catch (error) {
        log.error('Failed to load app info', error);
      }
    };
    loadAppInfo();
  }, []);

  const handleAuthorClick = async () => {
    try {
      await window.api.appOpenExternal({ url: 'https://learnwithhasan.com/vidtsx' });
    } catch (error) {
      log.error('Failed to open external link', error);
    }
  };

  const appRamMB = current ? Math.round(current.appRamBytes / 1024 / 1024) : 0;
  const ramPercent = current && current.ramTotalBytes > 0
    ? Math.round((current.ramUsedBytes / current.ramTotalBytes) * 100)
    : 0;
  const gpuAvailable = current?.gpu.available === true && current.gpu.usagePercent !== undefined;

  return (
    <div
      className="h-6 bg-app-deep flex items-center px-2 gap-3"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <span className="text-text-dim" style={{ fontSize: '10px' }}>
        v{version}
      </span>
      <span
        className="text-accent-light"
        style={{
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.5px',
          padding: '1px 5px',
          borderRadius: '3px',
          border: '0.5px solid var(--color-accent-light)',
          lineHeight: 1,
        }}
      >
        BETA
      </span>

      {/* CPU metric */}
      {current && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim" style={{ fontSize: '9px' }}>CPU</span>
          <TinySparkline data={cpuHistory} color="#7F77DD" />
          <span className="text-text-secondary font-mono" style={{ fontSize: '10px', minWidth: '28px', textAlign: 'right' }}>
            {current.cpuPercent}%
          </span>
        </div>
      )}

      {/* System RAM metric */}
      {current && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim" style={{ fontSize: '9px' }}>RAM</span>
          <TinySparkline data={ramHistory} color="#5DCAA5" />
          <span className="text-text-secondary font-mono" style={{ fontSize: '10px', minWidth: '28px', textAlign: 'right' }}>
            {ramPercent}%
          </span>
        </div>
      )}

      {/* App Memory metric */}
      {current && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim" style={{ fontSize: '9px' }}>MEM</span>
          <TinySparkline data={appRamHistory} max={Math.max(512, ...appRamHistory)} color="#E0A458" />
          <span className="text-text-secondary font-mono" style={{ fontSize: '10px', minWidth: '42px', textAlign: 'right' }}>
            {appRamMB} MB
          </span>
        </div>
      )}

      {/* GPU metric */}
      {gpuAvailable && (
        <div className="flex items-center gap-1.5">
          <span className="text-text-dim" style={{ fontSize: '9px' }}>GPU</span>
          <TinySparkline data={gpuHistory} color="#F09595" />
          <span className="text-text-secondary font-mono" style={{ fontSize: '10px', minWidth: '28px', textAlign: 'right' }}>
            {current!.gpu.usagePercent}%
          </span>
        </div>
      )}

      <div className="flex-1" />

      <button
        onClick={handleAuthorClick}
        className="text-text-muted hover:text-accent transition-colors duration-150"
        style={{ fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        VidTSX
      </button>
    </div>
  );
}
