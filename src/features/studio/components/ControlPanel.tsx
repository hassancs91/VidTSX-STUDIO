import { useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  ScanSearch,
  Scissors,
  Captions,
  Blend,
  Type,
  Sparkles,
  Code2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Tab {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

// SFX + Music tabs are intentionally hidden for now — they'll return once AI
// generation/automation for them ships. Users can still import SFX/music
// assets via the import flow in the meantime.
const TABS: Tab[] = [
  { id: 'analyze', label: 'Analyze', icon: ScanSearch },
  { id: 'auto-cut', label: 'Auto Cut', icon: Scissors },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'tsx', label: 'TSX', icon: Code2 },
  { id: 'transitions', label: 'Transitions', icon: Blend },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  // Animations: feature is code-complete but HIDDEN for this release. To ship it,
  // uncomment this entry (the tab content, engine, hooks, and timeline arrows are
  // all still wired) — and the matching line in PASTE_CATEGORY_META (types.ts).
  // { id: 'animations', label: 'Animations', icon: Film },
];

interface ControlPanelProps {
  analyzeTab: ReactNode;
  autoCutTab: ReactNode;
  captionsTab: ReactNode;
  transitionsTab: ReactNode;
  textTab: ReactNode;
  effectsTab: ReactNode;
  animationsTab: ReactNode;
  tsxTab: ReactNode;
}

export function ControlPanel({ analyzeTab, autoCutTab, captionsTab, transitionsTab, textTab, effectsTab, animationsTab, tsxTab }: ControlPanelProps) {
  const [activeTab, setActiveTab] = useState('analyze');
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  // Labels are always shown; when the row is wider than the panel we expose
  // left/right arrows to scroll through the tabs instead of squishing them.
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the selected tab in view when it's activated off-screen.
  useLayoutEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTab]);

  const scrollByStep = (direction: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(120, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <div
      className="h-full flex flex-col"
      style={{
        backgroundColor: 'var(--color-app-surface)',
        borderRight: '0.5px solid var(--color-border)',
      }}
    >
      {/* Tab bar — labels are always visible. When the row is wider than the
          panel, left/right arrows appear so tabs can be scrolled into view
          instead of being squished. */}
      <div
        className="flex shrink-0 items-stretch"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {showArrows && (
          <button
            onClick={() => scrollByStep(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll tabs left"
            className="shrink-0 flex items-center justify-center w-6 h-[34px] transition-colors disabled:opacity-30"
            style={{
              color: 'var(--color-text-secondary)',
              borderRight: '0.5px solid var(--color-border)',
            }}
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex flex-1 min-w-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const isHovered = hoveredTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                className="flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 h-[34px] text-[11px] font-medium whitespace-nowrap transition-colors"
                style={{
                  color: isActive
                    ? 'var(--color-accent-light)'
                    : isHovered
                      ? 'var(--color-text-secondary)'
                      : 'var(--color-text-dim)',
                  backgroundColor: isHovered && !isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                  borderBottom: isActive
                    ? '2px solid var(--color-accent)'
                    : '2px solid transparent',
                }}
              >
                <Icon size={13} strokeWidth={1.75} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {showArrows && (
          <button
            onClick={() => scrollByStep(1)}
            disabled={!canScrollRight}
            aria-label="Scroll tabs right"
            className="shrink-0 flex items-center justify-center w-6 h-[34px] transition-colors disabled:opacity-30"
            style={{
              color: 'var(--color-text-secondary)',
              borderLeft: '0.5px solid var(--color-border)',
            }}
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'analyze' && analyzeTab}
        {activeTab === 'auto-cut' && autoCutTab}
        {activeTab === 'captions' && captionsTab}
        {activeTab === 'transitions' && transitionsTab}
        {activeTab === 'text' && textTab}
        {activeTab === 'effects' && effectsTab}
        {activeTab === 'animations' && animationsTab}
        {activeTab === 'tsx' && tsxTab}
      </div>
    </div>
  );
}
