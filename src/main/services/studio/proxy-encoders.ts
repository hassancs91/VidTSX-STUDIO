/**
 * The pure half of GPU proxy encoding: which hardware encoders a full ffmpeg
 * build lists, which one to use, and the exact ffmpeg arguments per vendor.
 * No spawning, no fs — ffmpeg-full.ts owns the download and the probes, and
 * proxy-generator.ts owns the transcode loop. Everything here is unit-testable.
 *
 * Measured 2026-09-02 (T4b, docs/PREVIEW_TESTS_PLAN.md) on a GTX 1650 Ti:
 * NVENC with the whole pipeline on the card (NVDEC → scale_cuda → NVENC)
 * turned 60 s of 4K60 10-bit HEVC into a size-matched all-intra 540p proxy
 * in 12 s against 91 s for the shipping x264 path, at 8 CPU-seconds instead
 * of 250. Handing NVENC frames from system memory instead was only 1.6×
 * faster, because the CPU-side 4K scaler costs more than x264 does at 540p.
 */

export type ProxyGpuEncoder = 'nvenc' | 'qsv' | 'amf';

/** In order of preference when a machine has more than one. */
export const PROXY_GPU_ENCODERS: readonly ProxyGpuEncoder[] = ['nvenc', 'qsv', 'amf'];

export const PROXY_GPU_ENCODER_LABELS: Record<ProxyGpuEncoder, string> = {
  nvenc: 'NVIDIA NVENC',
  qsv: 'Intel Quick Sync',
  amf: 'AMD AMF',
};

const FFMPEG_ENCODER_NAMES: Record<ProxyGpuEncoder, string> = {
  nvenc: 'h264_nvenc',
  qsv: 'h264_qsv',
  amf: 'h264_amf',
};

/**
 * Constant-quality settings, one per vendor. These are NOT x264 CRF values —
 * every vendor has its own scale. NVENC's `-cq 33` was tuned until the file
 * size matched the x264 CRF 28 profile on the same footage (22.8 MB vs 22.9
 * MB per 60 s of 4K60). QSV and AMF could not be measured on the test
 * machine (see the docs); their numbers are the vendors' documented
 * equivalents and are tagged into the profile so a later retune never
 * concatenates with older windows.
 */
export const PROXY_GPU_QUALITY: Record<ProxyGpuEncoder, number> = {
  nvenc: 33,
  qsv: 33,
  amf: 30,
};

/**
 * Parse `ffmpeg -encoders` and return the hardware H.264 encoders it lists,
 * in preference order. Listing is necessary, not sufficient: a listed
 * encoder can still refuse to open (the 9.0.1 build lists h264_nvenc and
 * then rejects any driver older than 610), which is what the functional
 * probe in ffmpeg-full.ts is for.
 */
export function parseHardwareEncoders(encodersOutput: string): ProxyGpuEncoder[] {
  const names = new Set<string>();
  for (const line of encodersOutput.split(/\r?\n/)) {
    // " V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)"
    const m = /^\s*V[A-Z.]{5}\s+(\S+)/.exec(line);
    if (m) names.add(m[1]);
  }
  return PROXY_GPU_ENCODERS.filter((e) => names.has(FFMPEG_ENCODER_NAMES[e]));
}

/** First working encoder in preference order, or null. */
export function chooseProxyEncoder(working: readonly ProxyGpuEncoder[]): ProxyGpuEncoder | null {
  return PROXY_GPU_ENCODERS.find((e) => working.includes(e)) ?? null;
}

/**
 * Minimal encode used to prove an encoder actually opens on this machine and
 * driver: two synthetic frames to a null muxer, no media touched. Exit code 0
 * is the verdict.
 */
export function encoderProbeArgs(encoder: ProxyGpuEncoder): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=256x144:rate=30',
    '-frames:v',
    '2',
    ...encoderArgs(encoder),
    ...(encoder === 'nvenc' ? [] : ['-pix_fmt', 'nv12']),
    '-f',
    'null',
    '-',
  ];
}

/** Output-side encoder arguments, all-intra. */
export function encoderArgs(encoder: ProxyGpuEncoder): string[] {
  const q = String(PROXY_GPU_QUALITY[encoder]);
  switch (encoder) {
    case 'nvenc':
      // Intra-only is "-g 0" on NVENC (ffmpeg maps it to frameIntervalP=0,
      // gopLength=1); "-g 1" trips its "GOP length > B-frames + 1" check even
      // with -bf 0. Verified: every output frame is key_frame=1 pict_type=I.
      return ['-c:v', 'h264_nvenc', '-preset', 'p4', '-rc', 'vbr', '-cq', q, '-b:v', '0', '-g', '0', '-bf', '0'];
    case 'qsv':
      // ICQ mode: -global_quality without a bitrate.
      return ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', q, '-g', '1', '-bf', '0'];
    case 'amf':
      return ['-c:v', 'h264_amf', '-quality', 'balanced', '-rc', 'cqp', '-qp_i', q, '-qp_p', q, '-g', '1', '-bf', '0'];
  }
}

export interface GpuSegmentPlan {
  /** Input-side (before -i): hardware decode setup. */
  inputArgs: string[];
  /** The -vf filter graph: scale (and format) either on the card or in software. */
  videoFilter: string;
  /** Output-side: encoder plus pixel format when frames are in system memory. */
  outputArgs: string[];
  /** Manifest tag; distinct from the x264 tag so windows never mix. */
  profile: string;
}

/**
 * The per-window arguments for one vendor.
 *
 * NVENC: the whole pipeline stays on the NVIDIA card — NVDEC decodes
 * (`-hwaccel cuda`; on the tested driver NVENC cannot use the d3d11va decode
 * device: "CreateInputBuffer failed"), scale_cuda resizes and converts the
 * 10-bit source to 8-bit, NVENC reads the frames where they are. This is the
 * measured 7.5× path.
 *
 * QSV / AMF: the shipping d3d11va decode (adapter chosen by proxy-hwaccel.ts),
 * frames downloaded to system memory, the software scaler, then the vendor
 * encoder — the same shape as x264 with only the encoder swapped. Correct by
 * construction but unmeasured; the sticky fallback in the generator covers a
 * machine where it does not open.
 */
export function gpuSegmentPlan(encoder: ProxyGpuEncoder, height: number, decodeArgs: string[]): GpuSegmentPlan {
  const profile = `${encoder}-${height}p-intra-q${PROXY_GPU_QUALITY[encoder]}`;
  if (encoder === 'nvenc') {
    return {
      inputArgs: ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'],
      videoFilter: `scale_cuda=w=-2:h=min(${height}\\,ih):format=yuv420p`,
      outputArgs: encoderArgs(encoder),
      profile,
    };
  }
  return {
    inputArgs: decodeArgs,
    videoFilter: `scale=-2:min(${height}\\,ih)`,
    outputArgs: [...encoderArgs(encoder), '-pix_fmt', 'nv12'],
    profile,
  };
}
