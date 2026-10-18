// The composer's Kind and Style pickers (TSX_BUILDER_DESIGN.md P4, P4-3 (a)),
// beside Brand. A Kind sets the composer's settings it suggests and says so
// under the picker; "Your own…" opens a box for the user's words.

import type { CraftPackInfo } from '@shared/studio/craft-pack';
import { CUSTOM_STYLE_ID, hasCustomStyle, kindOptions, styleOptions, suggestLine, type CraftChoice } from '../services/craft-choice';

export interface MotionCraftFieldsProps {
  packs: CraftPackInfo[];
  choice: CraftChoice;
  onKindChange: (kindId: string) => void;
  onStyleChange: (styleId: string) => void;
  onCustomStyleChange: (words: string) => void;
}

const SELECT =
  'bg-app-base border border-border rounded-[6px] px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer w-full';

export function MotionCraftFields({ packs, choice, onKindChange, onStyleChange, onCustomStyleChange }: MotionCraftFieldsProps) {
  const kinds = kindOptions(packs);
  const styles = styleOptions(packs);
  const kind = kinds.find((k) => k.id === choice.kindId);
  const set = suggestLine(kind?.suggest);
  const custom = choice.styleId === CUSTOM_STYLE_ID;

  return (
    <>
      <div className="px-3 pb-3 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">
          Kind <span className="text-text-dim">(optional)</span>
        </label>
        <select className={SELECT} value={choice.kindId} onChange={(e) => onKindChange(e.target.value)} data-motion-kind>
          <option value="">None</option>
          {kinds.map((k) => (
            <option key={k.id} value={k.id} title={k.description}>
              {k.name}
            </option>
          ))}
        </select>
        {kind && (
          <span className="text-[9px] text-text-dim" data-motion-kind-hint>
            {kind.description}
            {set ? ` Set ${set} above; change any of them.` : ''}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 flex flex-col gap-1">
        <label className="text-[10px] text-text-dim">
          Style <span className="text-text-dim">(optional)</span>
        </label>
        <select className={SELECT} value={choice.styleId} onChange={(e) => onStyleChange(e.target.value)} data-motion-style>
          <option value="">None</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id} title={s.description}>
              {s.name}
            </option>
          ))}
          {hasCustomStyle(packs) && <option value={CUSTOM_STYLE_ID}>Your own…</option>}
        </select>
        {custom && (
          <>
            <textarea
              className="bg-app-base text-text-primary rounded-[6px] px-2 py-1.5 resize-none focus:outline-none"
              style={{ fontSize: 11, border: '0.5px solid var(--color-border-input)', minHeight: 56, fontFamily: 'inherit' }}
              placeholder="Describe the look in your own words: colours, lines, type, texture…"
              value={choice.customStyle}
              onChange={(e) => onCustomStyleChange(e.target.value)}
              data-motion-style-words
            />
            {!choice.customStyle.trim() && <span className="text-[9px] text-text-dim">Empty: no style is sent.</span>}
          </>
        )}
      </div>
    </>
  );
}
