// The staged loading state of a project open (video-10 feedback item 2):
// reading project.json → the timeline reducer adopting it → shot modules N of
// total → the first Player frame painted. Pure, so the stage rules are tested
// apart from the overlay that draws them.

export type OpenStageId = 'read' | 'timeline' | 'shots' | 'frame';
export type OpenStageState = 'done' | 'active' | 'pending';

export interface OpenStageView {
  id: OpenStageId;
  label: string;
  state: OpenStageState;
  detail?: string;
}

export interface OpenProgressInput {
  /** project:load returned the document. */
  documentLoaded: boolean;
  /** The timeline reducer adopted it — the editor can mount. */
  timelineReady: boolean;
  shots: { synced: boolean; total: number; settled: number; failed: number };
  /** The Player committed with every module settled and two frames went by. */
  framePainted: boolean;
}

export interface OpenProgress {
  stages: OpenStageView[];
  /** Every stage done: the editor is interactive, the overlay goes away. */
  done: boolean;
  /** 0..1 across the whole open, for the progress bar. */
  fraction: number;
}

export function shotsSettled(shots: OpenProgressInput['shots']): boolean {
  return shots.synced && shots.settled >= shots.total;
}

export function openProgress(input: OpenProgressInput): OpenProgress {
  const shotsDone = input.timelineReady && shotsSettled(input.shots);
  const flags: Array<[OpenStageId, string, boolean]> = [
    ['read', 'Reading project', input.documentLoaded],
    ['timeline', 'Preparing timeline', input.documentLoaded && input.timelineReady],
    ['shots', 'Loading shots', shotsDone],
    ['frame', 'Drawing the first frame', shotsDone && input.framePainted],
  ];
  const firstOpen = flags.findIndex(([, , done]) => !done);
  const stages = flags.map(([id, label, done], index): OpenStageView => {
    const state: OpenStageState = done ? 'done' : index === firstOpen ? 'active' : 'pending';
    const view: OpenStageView = { id, label, state };
    if (id === 'shots' && input.shots.synced && input.shots.total > 0) {
      const failed = input.shots.failed > 0 ? ` · ${input.shots.failed} failed` : '';
      view.detail = `${Math.min(input.shots.settled, input.shots.total)} of ${input.shots.total}${failed}`;
    }
    return view;
  });

  // Reading and preparing are quick; shots carry most of the bar.
  const shotShare =
    input.shots.synced && input.shots.total > 0 ? Math.min(1, input.shots.settled / input.shots.total) : shotsDone ? 1 : 0;
  const fraction =
    (input.documentLoaded ? 0.15 : 0) +
    (input.documentLoaded && input.timelineReady ? 0.1 : 0) +
    (input.timelineReady ? 0.65 * shotShare : 0) +
    (shotsDone && input.framePainted ? 0.1 : 0);

  return { stages, done: firstOpen === -1, fraction: Math.min(1, fraction) };
}
