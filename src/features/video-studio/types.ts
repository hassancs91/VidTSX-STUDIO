import type { VideoStudioEntry, VideoStudioFolder } from '../../shared/ipc/types';

export interface GalleryVideo extends VideoStudioEntry {
  /** file:// URL to the video file on disk. */
  videoUrl: string;
  /** file:// URL to the JPEG thumbnail, or null if thumbnail extraction failed. */
  thumbnailUrl: string | null;
}

export interface GalleryFolder extends VideoStudioFolder {
  videoCount: number;
  /** Thumbnail URLs from the first up-to-4 videos in this folder. */
  coverThumbnailUrls: string[];
}
