import { CUT_PLAN_KNOBS } from '@shared/studio/cut-style-spec';
import { CUT_KNOB_INFO, formatCutKnob } from '@shared/studio/cut-style-labels';
import type { ResolvedCutStyleState } from '../hooks/useResolvedCutStyle';

interface Props {
  /** The ONE resolved style the editor already holds (EditorShell's `useResolvedCutStyle`). */
  cutStyle: ResolvedCutStyleState;
}

/**
 * Project settings' read-out of the resolved cut style (plan T1, B2): the
 * name the Auto Cut card shows, then every knob Auto Cut, Transcript deletes
 * and the editorial pass snap with. Read-only — the override lives beside the
 * Auto Cut button, the knobs in the preset's Cut section.
 */
export function ProjectCutStyleFields({ cutStyle }: Props) {
  const resolved = cutStyle.resolved;
  if (!resolved) {
    return (
      <div className="text-[11px] text-text-dim" data-project-cut-style>
        {cutStyle.error ? <span className="text-accent-red">{cutStyle.error}</span> : 'Resolving…'}
      </div>
    );
  }
  const changed = new Set(resolved.overrides);
  return (
    <div className="flex flex-col gap-2" data-project-cut-style>
      <div className="text-[11px] text-text-secondary" data-project-cut-style-name>
        {resolved.displayName}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {CUT_PLAN_KNOBS.map((knob) => {
          const value = resolved.style[knob];
          const info = CUT_KNOB_INFO[knob];
          return (
            <div
              key={knob}
              className="flex items-baseline justify-between gap-2 text-[11px]"
              title={changed.has(knob) ? `${info.hint} Differs from ${resolved.styleName}.` : info.hint}
              data-project-cut-knob={knob}
            >
              <span className="text-text-dim">{info.label}</span>
              <span
                className={
                  value === undefined ? 'text-text-dim' : changed.has(knob) ? 'text-accent' : 'text-text-secondary'
                }
              >
                {formatCutKnob(knob, value)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-text-dim leading-snug">
        Auto Cut, Transcript deletes and the editorial pass snap with these. Change the style for
        this project beside the Auto Cut button (Inspector › Transcript, with a clip selected), or
        the knobs in the preset&rsquo;s Cut section (Assets › Presets).
      </p>
    </div>
  );
}
