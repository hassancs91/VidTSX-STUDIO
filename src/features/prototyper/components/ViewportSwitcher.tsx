import { IconButton } from '@shared/components/IconButton';

export interface ViewportPreset {
  key: string;
  label: string;
  width: number | null;
  height: number | null;
  icon: React.ReactNode;
}

const MonitorIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="2" width="12" height="8" rx="1" />
    <line x1="5" y1="12" x2="9" y2="12" />
    <line x1="7" y1="10" x2="7" y2="12" />
  </svg>
);

const TabletIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="1" width="9" height="12" rx="1.5" />
    <line x1="6" y1="11" x2="8" y2="11" />
  </svg>
);

const MobileIcon = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="1" width="7" height="12" rx="1.5" />
    <line x1="6" y1="11" x2="8" y2="11" />
  </svg>
);

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { key: 'desktop', label: 'Desktop', width: null, height: null, icon: MonitorIcon },
  { key: 'tablet', label: 'Tablet (768×1024)', width: 768, height: 1024, icon: TabletIcon },
  { key: 'mobile', label: 'Mobile (375×812)', width: 375, height: 812, icon: MobileIcon },
];

interface ViewportSwitcherProps {
  activeViewport: string;
  onViewportChange: (key: string) => void;
}

export function ViewportSwitcher({ activeViewport, onViewportChange }: ViewportSwitcherProps) {
  return (
    <div className="flex items-center gap-1">
      {VIEWPORT_PRESETS.map((preset) => (
        <IconButton
          key={preset.key}
          icon={preset.icon}
          label={preset.label}
          active={activeViewport === preset.key}
          onClick={() => onViewportChange(preset.key)}
        />
      ))}
    </div>
  );
}
