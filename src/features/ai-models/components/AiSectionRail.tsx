import { AI_SECTION_GROUP_LABELS, AI_SECTION_GROUP_ORDER, type AiSection, type AiSectionId } from '../types';

interface AiSectionRailProps {
  sections: readonly AiSection[];
  active: AiSectionId;
  onSelect: (id: AiSectionId) => void;
}

/**
 * The left section rail of the AI Models screen (docs/ai-models-redesign.md
 * §2): a vertical list of sections in three groups, the same active / hover
 * treatment as the app sidebar (UI_SPEC "Sidebar"), so the content beside it
 * can fill a maximized window instead of floating in a centred column.
 */
export function AiSectionRail({ sections, active, onSelect }: AiSectionRailProps) {
  return (
    <nav
      aria-label="AI Models sections"
      data-ai-rail
      className="w-[168px] shrink-0 overflow-y-auto bg-app-surface px-2 py-2"
      style={{ borderRight: '0.5px solid var(--color-border)' }}
    >
      {AI_SECTION_GROUP_ORDER.map((group) => {
        const items = sections.filter((s) => s.group === group);
        if (items.length === 0) return null;
        const caption = AI_SECTION_GROUP_LABELS[group];
        return (
          <div key={group} className="mb-3 last:mb-0">
            {caption && (
              <div className="px-2 pb-1 pt-2 text-[9px] font-medium uppercase tracking-[0.06em] text-text-dim">
                {caption}
              </div>
            )}
            {items.map((section) => {
              const isActive = section.id === active;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-current={isActive ? 'page' : undefined}
                  data-ai-section={section.id}
                  className={`mb-0.5 h-[26px] w-full rounded-[6px] px-2 text-left text-[11px] font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-app-active text-accent-light'
                      : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
                  }`}
                >
                  {section.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
