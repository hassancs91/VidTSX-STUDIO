// Project notes (video-10 import gap 7): Markdown files under
// `<project>/notes/`, the folder-as-truth home for plans, import reports, QA
// passes and anything the user wants the assistant to be able to read. One
// level deep, `.md` only; the name is the only identity.

import path from 'path';
import fs from 'fs/promises';
import type { StudioNoteInfo } from '../../../shared/ipc/types/studio-notes';
import { getProjectDir } from './studio-paths';

/** A note name: letters, digits, space, dash, underscore, dots inside the
 *  name — never a separator, never dots alone, at most 80 characters before
 *  the extension. */
const NOTE_NAME_PATTERN = /^(?!\.+$)[A-Za-z0-9][A-Za-z0-9 _.-]{0,79}$/;
export const NOTE_MAX_CHARS = 200_000;

/** `Plan` → `Plan.md`, `plan.md` stays; anything unsafe throws. */
export function normalizeNoteName(name: string): string {
  const trimmed = name.trim();
  const base = trimmed.toLowerCase().endsWith('.md') ? trimmed.slice(0, -3) : trimmed;
  if (!NOTE_NAME_PATTERN.test(base) || base.includes('..')) {
    throw new Error(`Invalid note name: ${name}`);
  }
  return `${base}.md`;
}

async function notesDir(projectId: string): Promise<string> {
  return path.join(await getProjectDir(projectId), 'notes');
}

async function notePath(projectId: string, name: string): Promise<string> {
  const dir = await notesDir(projectId);
  const resolved = path.resolve(dir, normalizeNoteName(name));
  if (path.dirname(resolved) !== dir) throw new Error('Note path escapes the notes folder');
  return resolved;
}

/** Every `.md` directly under notes/, newest first. A missing folder is an empty list. */
export async function listNotes(projectId: string): Promise<StudioNoteInfo[]> {
  const dir = await notesDir(projectId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  const notes: StudioNoteInfo[] = [];
  for (const entry of entries) {
    if (!entry.toLowerCase().endsWith('.md')) continue;
    try {
      const stat = await fs.stat(path.join(dir, entry));
      if (stat.isFile()) notes.push({ name: entry, size: stat.size, updatedAt: stat.mtimeMs });
    } catch {
      // A file that vanished between readdir and stat is simply not a note.
    }
  }
  return notes.sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
}

export async function readNote(projectId: string, name: string): Promise<string> {
  return fs.readFile(await notePath(projectId, name), 'utf8');
}

/** Atomic write (temp + rename) so a crash mid-save never leaves half a note. */
export async function writeNote(projectId: string, name: string, text: string): Promise<StudioNoteInfo> {
  if (text.length > NOTE_MAX_CHARS) {
    throw new Error(`Note is longer than ${NOTE_MAX_CHARS.toLocaleString()} characters`);
  }
  const target = await notePath(projectId, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, target);
  const stat = await fs.stat(target);
  return { name: path.basename(target), size: stat.size, updatedAt: stat.mtimeMs };
}

export async function deleteNote(projectId: string, name: string): Promise<void> {
  await fs.rm(await notePath(projectId, name), { force: true });
}
