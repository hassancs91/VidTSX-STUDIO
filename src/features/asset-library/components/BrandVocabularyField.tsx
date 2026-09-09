import { useState } from 'react';
import type { StudioBrandTerm } from '@shared/types/asset-library';
import {
  BRAND_VOCABULARY_MAX,
  formatVocabularyText,
  parseVocabularyText,
} from '@shared/studio/brand-vocabulary';

interface Props {
  value: StudioBrandTerm[] | undefined;
  onChange: (vocabulary: StudioBrandTerm[]) => void;
}

const textareaStyle = { border: '0.5px solid var(--color-border-input)' } as const;

/**
 * The brand's names and spellings (W4), one per line as `Term = alias, alias`.
 * The raw text is local state so a half-typed line never disappears under
 * the parser; the parsed list is what the form saves.
 */
export function BrandVocabularyField({ value, onChange }: Props) {
  const [text, setText] = useState(() => formatVocabularyText(value));
  const count = parseVocabularyText(text).length;

  return (
    <label className="flex flex-col gap-1 text-[10px] text-text-muted">
      <span className="flex items-center justify-between">
        <span>Vocabulary — names the transcriber must spell right (one per line, `Term = mangling, mangling`)</span>
        <span className={count > BRAND_VOCABULARY_MAX ? 'text-accent-red' : 'text-text-dim'}>
          {count}/{BRAND_VOCABULARY_MAX}
        </span>
      </span>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseVocabularyText(e.target.value));
        }}
        rows={4}
        placeholder={'VidTSX = Vid TSX, vid tsx\nLearnWithHasan = learn with hassan'}
        data-brand-vocabulary
        className="px-2 py-1.5 rounded bg-app-base text-text-primary text-[11px] font-mono focus:outline-none resize-none"
        style={textareaStyle}
      />
      <span className="text-text-dim leading-snug">
        Sent to the transcription engine as keyterms; manglings are corrected in every transcript.
        The assistant proposes new ones after each transcription.
      </span>
    </label>
  );
}
