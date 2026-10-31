// B5 Open problem 6: an opened deletion pill swaps its chip for the struck-through
// text + Restore IN PLACE, and for a long deletion near the bottom of the
// transcript the Restore landed below the visible body (measured 14 px below).
// Vitest runs in Node with no DOM, so the opened pill is rendered by calling its
// hook-free component and the ref it hands React is called with a stand-in node.

import { describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { OpenedDeletion, revealOnOpen } from './DeletionPill';
import type { TranscriptDeletion } from '../../services/transcript-doc';

const deletion = {
  id: 'a1:101.931:164.421:c1',
  text: 'found the file service … So',
  seconds: 62.49,
} as TranscriptDeletion;

type Props = { children?: ReactNode; ref?: unknown; [key: string]: unknown };

function find(node: ReactNode, match: (p: Props) => boolean): ReactElement<Props> | null {
  if (!isValidElement<Props>(node)) {
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = find(child as ReactNode, match);
        if (hit) return hit;
      }
    }
    return null;
  }
  if (match(node.props)) return node;
  return find(node.props.children, match);
}

describe('DeletionPill opened (B5 Open problem 6)', () => {
  it('hands the Restore button a ref that scrolls it into view', () => {
    const tree = OpenedDeletion({ deletion, readOnly: false, onRestore: vi.fn(), onHide: vi.fn() });
    const restore = find(tree, (p) => p['data-restore'] === deletion.id);
    expect(restore).not.toBeNull();
    const ref = (restore as unknown as { props: { ref?: unknown } }).props.ref;
    expect(ref).toBe(revealOnOpen);

    const scrollIntoView = vi.fn();
    revealOnOpen({ scrollIntoView } as unknown as HTMLElement);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
  });

  it('read-only (Auto Cut review open): no Restore, the opened text itself is revealed', () => {
    const tree = OpenedDeletion({ deletion, readOnly: true, onRestore: vi.fn(), onHide: vi.fn() });
    expect(find(tree, (p) => p['data-restore'] !== undefined)).toBeNull();
    expect((tree as unknown as { props: { ref?: unknown } }).props.ref).toBe(revealOnOpen);
  });

  it('Restore still calls onRestore with the deletion', () => {
    const onRestore = vi.fn();
    const tree = OpenedDeletion({ deletion, readOnly: false, onRestore, onHide: vi.fn() });
    const restore = find(tree, (p) => p['data-restore'] === deletion.id);
    (restore?.props.onClick as () => void)();
    expect(onRestore).toHaveBeenCalledWith(deletion);
  });

  it('a null ref (unmount) is a no-op', () => {
    expect(() => revealOnOpen(null)).not.toThrow();
  });
});
