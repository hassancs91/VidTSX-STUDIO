import { clipboard } from 'electron';
import type { ClipboardReadTextResponse } from '../../shared/ipc/types';

export async function handleClipboardReadText(): Promise<ClipboardReadTextResponse> {
  return { text: clipboard.readText() };
}

export const clipboardHandlers = {
  handleClipboardReadText,
};
