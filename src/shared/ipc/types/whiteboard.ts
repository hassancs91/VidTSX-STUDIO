import type { Scene, UserImageAsset, UserSvgAsset } from '@shared/types/whiteboard';

// ─── Whiteboard Studio projects ───
export interface WhiteboardProjectData {
  id: string;
  name: string;
  scene: Scene;
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WhiteboardProjectListResponse {
  success: boolean;
  projects?: WhiteboardProjectData[];
  error?: string;
}

export interface WhiteboardProjectSaveRequest {
  project: WhiteboardProjectData;
}

export interface WhiteboardProjectSaveResponse {
  success: boolean;
  error?: string;
}

export interface WhiteboardProjectLoadRequest {
  id: string;
}

export interface WhiteboardProjectLoadResponse {
  success: boolean;
  project?: WhiteboardProjectData;
  error?: string;
}

export interface WhiteboardProjectDeleteRequest {
  id: string;
}

export interface WhiteboardProjectDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Whiteboard Studio user SVG library ───
export interface WhiteboardUserSvgListResponse {
  success: boolean;
  svgs?: UserSvgAsset[];
  error?: string;
}

export interface WhiteboardUserSvgSaveRequest {
  asset: UserSvgAsset;
}

export interface WhiteboardUserSvgSaveResponse {
  success: boolean;
  error?: string;
}

export interface WhiteboardUserSvgDeleteRequest {
  id: string;
}

export interface WhiteboardUserSvgDeleteResponse {
  success: boolean;
  error?: string;
}

// ─── Whiteboard Studio user image library ───
export interface WhiteboardUserImageListResponse {
  success: boolean;
  images?: UserImageAsset[];
  error?: string;
}

export interface WhiteboardUserImageUploadRequest {
  /** base64-encoded raw bytes (no data: prefix). */
  base64: string;
  /** Filename used to derive name + extension. */
  filename: string;
  width: number;
  height: number;
}

export interface WhiteboardUserImageUploadResponse {
  success: boolean;
  image?: UserImageAsset;
  error?: string;
}

export interface WhiteboardUserImageDeleteRequest {
  id: string;
}

export interface WhiteboardUserImageDeleteResponse {
  success: boolean;
  error?: string;
}
