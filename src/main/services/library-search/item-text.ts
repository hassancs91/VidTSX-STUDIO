// The text a library item is embedded as (LIBRARY_SEARCH_DESIGN.md §3, S1's `itemText`, report §14): the file name
// without its extension, "-" / "_" read as spaces, then `audio.category`, the tags (", ") and the description,
// joined by ". " (missing parts left out). `textHash` (sha1 of that text) keys the vector cache: a changed name,
// description, tags or category re-embeds the item (§5). Pure.

import { createHash } from 'node:crypto';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import type { SemanticItem } from './types';

function spacedName(relPath: string): string {
  const file = relPath.split('/').pop() ?? relPath;
  return file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ');
}

export function itemText(entry: LibraryIndexEntry): string {
  return [spacedName(entry.relPath), entry.audio?.category ?? '', (entry.tags ?? []).join(', '), entry.description ?? '']
    .filter(Boolean)
    .join('. ');
}

export function textHash(text: string): string {
  return createHash('sha1').update(text, 'utf8').digest('hex');
}

/** The entry as the embedder sees it. */
export function semanticItemOf(entry: LibraryIndexEntry): SemanticItem {
  const text = itemText(entry);
  return { relPath: entry.relPath, text, textHash: textHash(text) };
}
