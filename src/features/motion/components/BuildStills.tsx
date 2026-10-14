// The latest look of a build: the frames the builder rendered and looked at,
// a contact sheet, or its phone view — the same images it saw.

import type { TsxBuildStillIpc } from '@shared/ipc/types';
import { lookTitle, stillCaption, stillUrl } from '../services/build-panel-view';

const IMAGE_CLASS: Record<TsxBuildStillIpc['size'], string> = {
  model: 'w-full h-auto',
  sheet: 'max-w-full max-h-[70vh] w-auto',
  phone: 'w-[260px] max-w-full h-auto',
};

export function BuildStills({ stills }: { stills: TsxBuildStillIpc[] }) {
  if (stills.length === 0) {
    return (
      <div className="text-[11px] text-text-dim py-6 text-center">
        No frames yet. The builder renders its first frames after its first passing check.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5" data-build-stills>
      <span className="text-[10px] text-text-dim">Latest look · {lookTitle(stills)}</span>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {stills.map((still) => (
          <figure key={still.path} className={`flex flex-col gap-0.5 m-0 ${still.size === 'model' ? '' : 'col-span-full items-start'}`}>
            <img
              src={stillUrl(still.path)}
              alt={stillCaption(still)}
              className={`rounded bg-app-base ${IMAGE_CLASS[still.size]}`}
              style={{ border: '0.5px solid var(--color-border)' }}
              // A running build's folder is gone once its version is saved
              onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
            />
            <figcaption className="text-[9px] text-text-dim">{stillCaption(still)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
