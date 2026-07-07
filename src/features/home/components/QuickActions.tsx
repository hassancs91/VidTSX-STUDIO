import type { ReactNode } from 'react';
import { Wand2, Images, Mic } from 'lucide-react';
import { isFeatureEnabled } from '@shared/feature-flags';

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
}

const ICON_SIZE = 18;
const ICON_STROKE = 1.5;

const actions: QuickAction[] = [
  {
    id: 'creator',
    label: 'Creator',
    description: 'Design motion graphics and animated videos',
    icon: <Wand2 size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    id: 'image-studio',
    label: 'Image Studio',
    description: 'Generate and edit images with AI',
    icon: <Images size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
  {
    id: 'transcribe',
    label: 'Transcribe',
    description: 'Convert speech to text with Whisper AI',
    icon: <Mic size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
  },
];

function navigate(screen: string) {
  window.dispatchEvent(
    new CustomEvent('vidtsx:navigate', { detail: { screen } }),
  );
}

export function QuickActions() {
  return (
    <div>
      <div className="text-[11px] text-text-dim uppercase tracking-wider mb-3">
        Quick Actions
      </div>
      <div className="grid grid-cols-2 gap-3">
        {actions.filter((a) => isFeatureEnabled(a.id)).map((action) => (
          <button
            key={action.id}
            onClick={() => navigate(action.id)}
            className="flex flex-col gap-3 bg-app-surface rounded-[8px] p-4 text-left hover:bg-app-hover transition-colors duration-150 cursor-pointer group"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            <div className="w-9 h-9 rounded-[8px] bg-app-base flex items-center justify-center text-text-muted group-hover:text-accent transition-colors duration-150">
              {action.icon}
            </div>
            <div>
              <div className="text-[12px] text-text-primary font-medium">
                {action.label}
              </div>
              <div className="text-[10px] text-text-dim mt-0.5 leading-relaxed">
                {action.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
