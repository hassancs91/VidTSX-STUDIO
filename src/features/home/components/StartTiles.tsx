import type { ReactNode } from 'react';
import { Bot, Clapperboard, Film, Images, Wand2, Workflow } from 'lucide-react';
import { isFeatureEnabled } from '@shared/feature-flags';
import type { HomeStartTile } from '../types';
import { goToScreen, startNewStudioProject } from '../services/home-navigation';
import { SectionRow } from './SectionRow';

const ICON = { size: 18, strokeWidth: 1.5 } as const;

/** The tiles, in order. Each is hidden with its screen's feature flag, so a
 *  build without Flows shows five. */
export const START_TILES: HomeStartTile[] = [
  { id: 'edit', screen: 'studio', title: 'Edit a video', description: 'New Studio project — footage, cuts, captions, shots' },
  { id: 'motion', screen: 'creator', title: 'Create a motion graphic', description: 'TSX composition from a prompt or in Agent mode' },
  { id: 'agent', screen: 'agents', title: 'Run an agent', description: 'Pick an agent and start from a quick start' },
  { id: 'image', screen: 'image-studio', title: 'Generate an image', description: 'Cloud or local image models' },
  { id: 'video', screen: 'video-studio', title: 'Generate a video', description: 'Cloud video models with your own keys' },
  { id: 'flow', screen: 'flows', title: 'Build a flow', description: 'Chain tools and agents into a graph' },
];

const ICONS: Record<string, ReactNode> = {
  edit: <Clapperboard {...ICON} />,
  motion: <Wand2 {...ICON} />,
  agent: <Bot {...ICON} />,
  image: <Images {...ICON} />,
  video: <Film {...ICON} />,
  flow: <Workflow {...ICON} />,
};

function activate(tile: HomeStartTile): void {
  if (tile.id === 'edit') startNewStudioProject();
  else goToScreen(tile.screen);
}

export function StartTiles() {
  const tiles = START_TILES.filter((t) => isFeatureEnabled(t.screen));
  return (
    <section data-home-section="start">
      <SectionRow title="Start" />
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
      >
        {tiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => activate(tile)}
            data-home-start={tile.id}
            className="flex items-start gap-2.5 text-left px-3 py-2.5 rounded-[8px] bg-app-surface hover:bg-app-hover transition-colors"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            <span className="shrink-0 mt-px text-accent-light">{ICONS[tile.id]}</span>
            <span className="min-w-0">
              <span className="block text-[12px] font-medium text-text-primary">{tile.title}</span>
              <span className="block text-[10px] text-text-muted mt-0.5 leading-snug">{tile.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
