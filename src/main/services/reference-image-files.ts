// Reference image CRUD now lives in image-studio-db.ts (SQLite). This file is
// kept as a thin re-export so IPC handlers can keep their existing import path.
export {
  saveReference,
  listReferences,
  deleteReference,
  toggleReference,
  readReferenceBuffer,
} from './image-studio-db';
