import { useState, useCallback, useRef, useEffect } from 'react';
import { CodeEditor } from '@features/editor';
import { HtmlPreview } from './HtmlPreview';
import { ViewportSwitcher, VIEWPORT_PRESETS } from './ViewportSwitcher';
import { IconButton } from '@shared/components/IconButton';

type Tab = 'preview' | 'code';

interface PreviewPanelProps {
  html: string;
  onHtmlChange: (html: string) => void;
  onSave: () => void;
  onScreenshot: (html: string, width: number, height: number) => Promise<string | null>;
  onRecordStart: (html: string, width: number, height: number) => Promise<boolean>;
  onRecordStop: () => Promise<string | null>;
}

const CameraIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4.5A1.5 1.5 0 013.5 3h1l.5-1h4l.5 1h1A1.5 1.5 0 0112 4.5v5a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 9.5v-5z" />
    <circle cx="7" cy="7" r="2" />
  </svg>
);

const RecordIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5" fill="#ef4444" />
  </svg>
);

const StopIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="3" y="3" width="8" height="8" rx="1" fill="#ef4444" />
  </svg>
);

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PreviewPanel({ html, onHtmlChange, onSave, onScreenshot, onRecordStart, onRecordStop }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [viewport, setViewport] = useState('desktop');
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recording timer
  useEffect(() => {
    if (recording) {
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  const handleCodeChange = useCallback((content: string) => {
    onHtmlChange(content);
  }, [onHtmlChange]);

  const getViewportDimensions = useCallback(() => {
    const preset = VIEWPORT_PRESETS.find((p) => p.key === viewport);
    const iframe = iframeRef.current;
    const width = preset?.width ?? iframe?.clientWidth ?? 1280;
    const height = preset?.height ?? iframe?.clientHeight ?? 800;
    return { width, height };
  }, [viewport]);

  const handleScreenshot = useCallback(async () => {
    if (!html || capturing) return;
    const { width, height } = getViewportDimensions();

    setCapturing(true);
    try {
      await onScreenshot(html, width, height);
    } catch (err) {
      console.error('[PreviewPanel] Screenshot failed:', err);
    } finally {
      setCapturing(false);
    }
  }, [html, capturing, getViewportDimensions, onScreenshot]);

  const handleRecordToggle = useCallback(async () => {
    if (recording) {
      // Stop recording
      setRecording(false);
      await onRecordStop();
    } else {
      // Start recording
      if (!html) return;
      const { width, height } = getViewportDimensions();
      const started = await onRecordStart(html, width, height);
      if (started) {
        setRecording(true);
      }
    }
  }, [recording, html, getViewportDimensions, onRecordStart, onRecordStop]);

  const renderPreview = () => {
    if (!html) {
      return (
        <div className="flex items-center justify-center h-full text-text-dim text-[13px]">
          Send a message to generate a preview
        </div>
      );
    }

    const preset = VIEWPORT_PRESETS.find((p) => p.key === viewport);
    const isConstrained = preset && preset.width !== null;

    if (isConstrained) {
      return (
        <div
          className="flex items-center justify-center h-full w-full"
          style={{ backgroundColor: 'var(--color-app-base)' }}
        >
          <div
            style={{
              width: preset.width ?? undefined,
              height: preset.height ?? undefined,
              maxHeight: '100%',
              borderRadius: 8,
              overflow: 'hidden',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
              transition: 'width 150ms ease, height 150ms ease',
            }}
          >
            <HtmlPreview ref={iframeRef} html={html} />
          </div>
        </div>
      );
    }

    return <HtmlPreview ref={iframeRef} html={html} />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div
        className="flex items-center gap-0 px-3 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {(['preview', 'code'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-[12px] font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-accent-light'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab === 'preview' ? 'Preview' : 'Code'}
            {activeTab === tab && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: 'var(--color-accent)' }}
              />
            )}
          </button>
        ))}

        {/* Recording indicator */}
        {recording && (
          <div className="flex items-center gap-1.5 ml-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] text-red-400 font-mono">
              {formatDuration(recordSeconds)}
            </span>
          </div>
        )}

        <div className="flex-1" />
        {activeTab === 'preview' && (
          <div className="flex items-center gap-1">
            <IconButton
              icon={recording ? StopIcon : RecordIcon}
              label={recording ? 'Stop recording' : 'Record video'}
              disabled={!html && !recording}
              onClick={handleRecordToggle}
            />
            <IconButton
              icon={capturing ? (
                <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20" strokeDashoffset="5" />
                </svg>
              ) : CameraIcon}
              label="Take screenshot"
              disabled={!html || capturing || recording}
              onClick={handleScreenshot}
            />
            <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--color-border)' }} />
            <ViewportSwitcher activeViewport={viewport} onViewportChange={setViewport} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'preview' ? (
          renderPreview()
        ) : (
          html ? (
            <CodeEditor
              filePath={null}
              content={html}
              onChange={handleCodeChange}
              onSave={onSave}
              language="html"
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-text-dim text-[13px]">
              No code generated yet
            </div>
          )
        )}
      </div>
    </div>
  );
}
