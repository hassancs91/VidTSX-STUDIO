import { Bot, Wand2 } from 'lucide-react';
import { ProjectPoster, type PosterPalette } from '@shared/components/ProjectPoster';
import type { HomeContinueItem } from '../types';
import { formatRelative } from '../services/home-format';

interface Props {
  item: HomeContinueItem;
  /** Studio only: the poster data URL, or null for the placeholder. */
  posterSrc: string | null;
  palette: PosterPalette | null;
  onOpen: () => void;
}

/** A 16:9 tile for the kinds that have no poster of their own. */
function KindTile({ icon }: { icon: React.ReactNode }) {
  return (
    <div
      className="rounded-[3px] flex items-center justify-center bg-app-base text-text-dim"
      style={{ height: 94, aspectRatio: '16 / 9', border: '0.5px solid var(--color-border-hover)' }}
      data-poster="kind"
    >
      {icon}
    </div>
  );
}

function subtitle(item: HomeContinueItem): string {
  const when = formatRelative(item.updatedAtMs);
  switch (item.kind) {
    case 'studio':
      return ['Studio', `${item.width}×${item.height}`, when].filter(Boolean).join(' · ');
    case 'motion':
      return ['TSX', `v${item.versionCount}`, when].filter(Boolean).join(' · ');
    case 'session':
      return ['Agent', item.agentName, when].filter(Boolean).join(' · ');
  }
}

/** One Continue card — the Studio browser's card styling (UI_SPEC panel
 *  tones, 110 px media area, name + meta), for all three kinds. */
export function ContinueCard({ item, posterSrc, palette, onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      data-home-card={item.kind}
      data-home-card-key={item.key}
      className="group text-left flex flex-col rounded-[8px] bg-app-deep hover:bg-app-hover transition-colors cursor-pointer overflow-hidden"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <div className="h-[110px] flex items-center justify-center bg-app-surface px-2">
        {item.kind === 'studio' && (
          <ProjectPoster
            src={posterSrc}
            width={item.width}
            height={item.height}
            name={item.title}
            palette={palette}
          />
        )}
        {item.kind === 'motion' && <KindTile icon={<Wand2 size={20} strokeWidth={1.5} />} />}
        {item.kind === 'session' && <KindTile icon={<Bot size={20} strokeWidth={1.5} />} />}
      </div>
      <div className="px-2.5 py-2 w-full">
        <div className="text-[12px] font-medium text-text-primary truncate">{item.title}</div>
        <div className="text-[10px] text-text-muted mt-0.5 truncate">{subtitle(item)}</div>
      </div>
    </button>
  );
}
