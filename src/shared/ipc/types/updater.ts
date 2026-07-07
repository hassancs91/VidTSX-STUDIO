// ─── Updater types ───
export interface UpdaterSimpleResponse {
  ok: boolean;
  devMode?: boolean;
}

export interface UpdaterGetCurrentVersionResponse {
  version: string;
}

export interface UpdaterUpdateAvailableEvent {
  version: string;
  releaseNotes: string | null;
  releaseDate: string;
}

export interface UpdaterUpToDateEvent {
  version: string;
}

export interface UpdaterDownloadProgressEvent {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdaterUpdateDownloadedEvent {
  version: string;
}

export interface UpdaterErrorEvent {
  message: string;
}
