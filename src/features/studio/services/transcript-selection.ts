// Maps the browser's native text selection onto transcript words. The panel
// renders every word as <span data-i="N">word </span> — the trailing space
// lives INSIDE the span, so every selectable character belongs to a word and
// drag, shift-click, double-click and triple-click all come for free.

export interface TokenRange {
  /** First and last selected token index, inclusive. */
  from: number;
  to: number;
}

function wordElement(node: Node | null, root: HTMLElement): HTMLElement | null {
  const el = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  const word = el?.closest<HTMLElement>('[data-i]') ?? null;
  return word && root.contains(word) ? word : null;
}

/** Characters of the word itself — its trailing space does not count as the word. */
function wordLength(el: HTMLElement): number {
  return (el.textContent ?? '').trimEnd().length;
}

/** Boundary on a paragraph or the root, not inside a word: fall back to what the range touches. */
function scanBoundary(range: Range, root: HTMLElement, side: 'start' | 'end'): number | null {
  const words = root.querySelectorAll<HTMLElement>('[data-i]');
  if (side === 'start') {
    for (let i = 0; i < words.length; i++) {
      if (range.intersectsNode(words[i])) return Number(words[i].dataset.i);
    }
    return null;
  }
  for (let i = words.length - 1; i >= 0; i--) {
    if (range.intersectsNode(words[i])) return Number(words[i].dataset.i);
  }
  return null;
}

/** The words a selection covers inside `root`, or null when it covers none. */
export function selectionTokenRange(selection: Selection | null, root: HTMLElement): TokenRange | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  let from: number | null;
  const startWord = wordElement(range.startContainer, root);
  if (startWord && range.startContainer.nodeType === Node.TEXT_NODE) {
    const index = Number(startWord.dataset.i);
    // A caret after the word's last character starts the selection at the next word.
    from = range.startOffset >= wordLength(startWord) ? index + 1 : index;
  } else {
    from = scanBoundary(range, root, 'start');
  }

  let to: number | null;
  const endWord = wordElement(range.endContainer, root);
  if (endWord && range.endContainer.nodeType === Node.TEXT_NODE) {
    const index = Number(endWord.dataset.i);
    // A caret before the word's first character ends the selection at the previous word.
    to = range.endOffset === 0 ? index - 1 : index;
  } else {
    to = scanBoundary(range, root, 'end');
  }

  if (from === null || to === null || Number.isNaN(from) || Number.isNaN(to) || to < from) return null;
  return { from, to };
}
