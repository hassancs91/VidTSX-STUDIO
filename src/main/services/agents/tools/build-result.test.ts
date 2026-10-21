// What an agent is told when a build ends (P3 part 4): which stills go back
// and the one text block beside them.

import { describe, it, expect } from 'vitest';
import type { TsxBuildJobIpc, TsxBuildStillIpc } from '../../../../shared/ipc/types';
import { buildResultText, pickResultStills } from './build-result';

/** Named as the builder names them: `r01-f030.jpg`, `r01v1-f030.jpg`, `r02-sheet-f000.jpg`, `phone1-f000.jpg`. */
const still = (
  round: number,
  frame: number,
  size: TsxBuildStillIpc['size'] = 'model',
  frames?: number[],
  label = `r${String(round).padStart(2, '0')}`,
): TsxBuildStillIpc => ({
  round,
  frame,
  size,
  path: `C:\\w\\v1.stills\\${size === 'phone' ? 'phone1' : label}${size === 'sheet' ? '-sheet' : ''}-f${String(frame).padStart(3, '0')}.jpg`,
  ...(frames ? { frames } : {}),
});

const build = (over: Partial<TsxBuildJobIpc> = {}): TsxBuildJobIpc => ({
  budget: 'standard',
  edit: false,
  phase: 'done',
  round: 2,
  roundsMax: 3,
  checks: 5,
  turns: 9,
  tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
  elapsedMs: 1000,
  stills: [],
  finished: true,
  ...over,
});

const config = { id: 'main', durationInFrames: 240, fps: 30, width: 1080, height: 1350 };

describe('pickResultStills', () => {
  it('takes the newest round with model frames, spread first / middle / last, and skips phone views', () => {
    const stills = [
      still(1, 0), still(1, 120),
      ...[0, 30, 60, 90, 120, 150, 180, 210, 239].map((f) => still(2, f)),
      still(3, 0, 'phone'),
    ];
    expect(pickResultStills(stills).map((s) => [s.round, s.frame])).toEqual([[2, 0], [2, 120], [2, 239]]);
  });

  it('keeps two or three frames as they are, in frame order', () => {
    expect(pickResultStills([still(1, 90), still(1, 0)]).map((s) => s.frame)).toEqual([0, 90]);
  });

  it('a look at the changed build after the budget (same round) wins over the look before it', () => {
    // V1 live (P3 part 4): Quick, r01 saw the ball on the title, the fix was looked at as r01v1.
    const first = [0, 30, 54, 60, 90].map((f) => still(1, f));
    const verify = [0, 30, 60, 90].map((f) => still(1, f, 'model', undefined, 'r01v1'));
    const picked = pickResultStills([...first, still(1, 60, 'phone'), ...verify]);
    expect(picked.map((s) => s.path.split('\\').pop())).toEqual(['r01v1-f000.jpg', 'r01v1-f060.jpg', 'r01v1-f090.jpg']);
  });

  it('the newest look is a contact sheet: that sheet alone; nothing without a look', () => {
    const sheet = still(3, 0, 'sheet', [0, 60, 120]);
    expect(pickResultStills([still(1, 0), still(2, 0), sheet, still(3, 0, 'phone')])).toEqual([sheet]);
    expect(pickResultStills([still(1, 0, 'phone')])).toEqual([]);
    expect(pickResultStills([])).toEqual([]);
  });
});

describe('buildResultText', () => {
  it('a new build: head, budget line with the verified checks, summary, frames', () => {
    const picked = [still(2, 0), still(2, 120), still(2, 239)];
    const text = buildResultText({
      kind: 'generate',
      title: 'Promo',
      relPath: 'compositions/promo/v1.tsx',
      config,
      build: build({ seamOk: true, numbersOk: true, summary: '  A ball bounces.  ' }),
      picked,
    });
    expect(text.split('\n')).toEqual([
      'Composition ready: compositions/promo/v1.tsx — 1080x1350, 8.0s at 30fps.',
      'Built on Standard: 2 looks, 5 checks, finished; loop seam OK, numbers checked.',
      "Builder's summary: A ball bounces.",
      'The pictures below are frames 0, 120 and 239 from its last look (round 2), as the builder saw them.',
    ]);
  });

  it('an edit that a cap stopped, with physics not verified, a sheet and no summary', () => {
    const text = buildResultText({
      kind: 'edit',
      title: 'Promo',
      relPath: 'compositions/promo/v2.tsx',
      config,
      build: build({ budget: 'quick', round: 1, checks: 1, finished: false, pureOk: false, numbersOk: false, notice: 'Stopped at the 15 min cap.' }),
      picked: [still(1, 0, 'sheet', [0, 80, 160])],
    });
    expect(text.split('\n')).toEqual([
      'Edited Promo: compositions/promo/v2.tsx — 1080x1350, 8.0s at 30fps.',
      'Built on Quick: 1 look, 1 check, stopped before it finished; physics purity NOT verified, numbers NOT verified (number_check: split or race).',
      'Stopped at the 15 min cap.',
      'The picture below is the contact sheet from its last look (round 1): frames 0, 80, 160, as the builder saw them.',
    ]);
  });

  it('no pictures (a flow) and no build block: the head alone', () => {
    expect(buildResultText({ kind: 'generate', title: 'X', relPath: 'compositions/x/v1.tsx', config, build: undefined, picked: [] })).toBe(
      'Composition ready: compositions/x/v1.tsx — 1080x1350, 8.0s at 30fps.',
    );
  });
});
