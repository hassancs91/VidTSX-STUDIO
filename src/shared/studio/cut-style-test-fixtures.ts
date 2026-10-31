// Fixed knob sets for the planner's unit tests — NOT the shipped styles
// (those are data: resources/skills/studio-clean-cut/cut-style.json, read by
// the main process and resolved per project). These are the pre-B2 tight and
// natural, kept so the mechanics tests keep their hand-checked numbers.

import type { CutPlanStyle } from '../types/studio-cut-plan';

export const TEST_TIGHT_STYLE: CutPlanStyle = {
  internalGap: 0.4,
  head: 0.11,
  minTail: 0.14,
  maxTail: 0.4,
  margin: 5.0,
  softGap: 1.2,
  softMaxTail: 0.6,
  softMargin: 3.0,
};

export const TEST_NATURAL_STYLE: CutPlanStyle = {
  ...TEST_TIGHT_STYLE,
  head: 0.19,
  minTail: 0.26,
  maxTail: 0.45,
};
