import { useState, useEffect, useRef, useCallback } from 'react';
import { parseGIF, decompressFrames, type ParsedFrame } from 'gifuct-js';

interface GifPlayerProps {
  src: string;
  className?: string;
}

export function GifPlayer({ src, className }: GifPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const framesRef = useRef<ParsedFrame[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLooping, setIsLooping] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [gifDims, setGifDims] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const currentFrameRef = useRef(0);
  const isPlayingRef = useRef(true);
  const isLoopingRef = useRef(true);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

  const renderFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || frames.length === 0 || frameIndex >= frames.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = frames[frameIndex];

    // Handle disposal of previous frame
    if (frameIndex === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Create temp canvas for this frame's patch
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
    }
    const tempCanvas = tempCanvasRef.current;
    tempCanvas.width = frame.dims.width;
    tempCanvas.height = frame.dims.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imageData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
    imageData.data.set(frame.patch);
    tempCtx.putImageData(imageData, 0, 0);

    // Handle disposal type before drawing new frame
    if (frameIndex > 0) {
      const prevFrame = frames[frameIndex - 1];
      if (prevFrame.disposalType === 2) {
        ctx.clearRect(
          prevFrame.dims.left,
          prevFrame.dims.top,
          prevFrame.dims.width,
          prevFrame.dims.height
        );
      }
    }

    ctx.drawImage(tempCanvas, frame.dims.left, frame.dims.top);

    currentFrameRef.current = frameIndex;
    setCurrentFrame(frameIndex);
  }, []);

  // Render all frames up to target for accurate seeking (disposal chain)
  const seekToFrame = useCallback((targetFrame: number) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || frames.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i <= targetFrame; i++) {
      renderFrame(i);
    }
  }, [renderFrame]);

  // Animation loop
  const animate = useCallback((timestamp: number) => {
    const frames = framesRef.current;
    if (!isPlayingRef.current || frames.length === 0) {
      rafRef.current = requestAnimationFrame(animate);
      return;
    }

    const frameIndex = currentFrameRef.current;
    const delay = Math.max(frames[frameIndex]?.delay ?? 100, 20); // Min 20ms to avoid zero-delay frames

    if (timestamp - lastTimeRef.current >= delay) {
      let nextFrame = frameIndex + 1;
      if (nextFrame >= frames.length) {
        if (isLoopingRef.current) {
          nextFrame = 0;
        } else {
          setIsPlaying(false);
          rafRef.current = requestAnimationFrame(animate);
          return;
        }
      }

      if (nextFrame === 0) {
        // Starting over — clear and render from scratch
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      renderFrame(nextFrame);
      lastTimeRef.current = timestamp;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [renderFrame]);

  // Load GIF
  useEffect(() => {
    let cancelled = false;

    const loadGif = async () => {
      setIsLoaded(false);
      setCurrentFrame(0);
      setIsPlaying(true);
      currentFrameRef.current = 0;
      isPlayingRef.current = true;

      // Cancel any running animation
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      try {
        const response = await fetch(src);
        const buffer = await response.arrayBuffer();
        if (cancelled) return;

        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);
        if (cancelled || frames.length === 0) return;

        framesRef.current = frames;

        const width = gif.lsd.width;
        const height = gif.lsd.height;
        setGifDims({ width, height });
        setTotalFrames(frames.length);

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
        }

        // Render first frame
        renderFrame(0);
        setIsLoaded(true);
        lastTimeRef.current = 0;

        // Start animation
        rafRef.current = requestAnimationFrame(animate);
      } catch {
        // GIF load failed — show nothing
      }
    };

    loadGif();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [src, renderFrame, animate]);

  // Start/stop animation loop when play state changes
  useEffect(() => {
    if (isLoaded && isPlaying) {
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, isLoaded, animate]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frame = Number(e.target.value);
    seekToFrame(frame);
  };

  const togglePlay = () => {
    if (!isPlaying && currentFrame >= totalFrames - 1 && !isLooping) {
      // Restart from beginning if at end and not looping
      seekToFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={`flex flex-col ${className ?? ''}`} style={{ minHeight: 0 }}>
      {/* Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: isLoaded ? 'block' : 'none',
          }}
        />
        {!isLoaded && (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Controls */}
      {isLoaded && (
        <div
          className="shrink-0 flex items-center gap-2 px-3 py-1.5"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-accent-light transition-colors cursor-pointer shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
                <rect x="3" y="2" width="3" height="10" rx="0.5" />
                <rect x="8" y="2" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg width={14} height={14} viewBox="0 0 14 14" fill="currentColor">
                <path d="M3.5 2.2L11.5 7L3.5 11.8V2.2Z" />
              </svg>
            )}
          </button>

          {/* Timeline slider */}
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={currentFrame}
            onChange={handleSliderChange}
            className="flex-1 h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-accent"
            style={{ minWidth: 0 }}
          />

          {/* Frame counter */}
          <span className="text-[9px] text-white/60 shrink-0 tabular-nums">
            {currentFrame + 1}/{totalFrames}
          </span>

          {/* Loop toggle */}
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`transition-colors cursor-pointer shrink-0 ${
              isLooping ? 'text-accent-light' : 'text-white/40 hover:text-white/60'
            }`}
            title={isLooping ? 'Looping on' : 'Looping off'}
          >
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 1L14 4L11 7" />
              <path d="M14 4H4a3 3 0 0 0-3 3" />
              <path d="M5 15L2 12L5 9" />
              <path d="M2 12h10a3 3 0 0 0 3-3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
