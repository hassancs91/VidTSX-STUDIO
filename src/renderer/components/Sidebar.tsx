import type { ReactNode } from "react";
import {
  Wand2,
  Images,
  Film,
  FolderOpen,
  Mic,
  Wrench,
  Boxes,
  ListVideo,
  Workflow,
  Settings,
} from "lucide-react";
import { isFeatureEnabled } from "@shared/feature-flags";

interface SidebarProps {
  activeScreen: string;
  onScreenChange: (screen: string) => void;
  renderBadgeCount?: number;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

const ICON_SIZE = 22;
const ICON_STROKE = 1.5;

const navItems: NavItem[] = [
  // Primary workflow — TSX → Image → Video
  { id: "creator", label: "TSX", icon: <Wand2 size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "flows", label: "Flows", icon: <Workflow size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "image-studio", label: "Images", icon: <Images size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "transcribe", label: "Transcribe", icon: <Mic size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  // Secondary
  { id: "video-studio", label: "Videos", icon: <Film size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "assets", label: "Assets", icon: <FolderOpen size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "ai-models", label: "AI", icon: <Boxes size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { id: "render", label: "Queue", icon: <ListVideo size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
];

const settingsItem: NavItem = {
  id: "settings",
  label: "Settings",
  icon: <Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
};

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col items-center justify-center gap-[1px]
        w-[53px] h-[53px] rounded-[10px]
        transition-colors duration-150
        ${isActive ? "bg-app-active text-accent-light" : "text-text-muted hover:bg-app-hover"}
      `}
    >
      {/* Badge */}
      {item.badge !== undefined && item.badge > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[9px] font-medium flex items-center justify-center"
        >
          {item.badge > 9 ? '9+' : item.badge}
        </span>
      )}
      <span
        className={`transition-transform duration-150 group-hover:scale-110 group-active:scale-95 ${isActive ? "text-accent-light" : "text-text-muted"}`}
      >
        {item.icon}
      </span>
      <span
        className={`text-[10px] leading-none ${isActive ? "text-accent-light" : "text-text-dim"}`}
      >
        {item.label}
      </span>
    </button>
  );
}

export function Sidebar({ activeScreen, onScreenChange, renderBadgeCount }: SidebarProps) {
  const visibleItems = navItems.filter((item) => isFeatureEnabled(item.id) && item.id !== 'render');

  const renderItem = navItems.find((item) => item.id === 'render');
  const renderWithBadge = renderItem && isFeatureEnabled('render')
    ? { ...renderItem, badge: renderBadgeCount }
    : null;

  return (
    <aside
      className="flex flex-col w-[67px] h-full bg-app-deep"
      style={{ borderRight: "0.5px solid var(--color-border)" }}
    >
      <nav
        className="flex flex-col items-center gap-2 pt-2 pb-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {visibleItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeScreen === item.id}
            onClick={() => onScreenChange(item.id)}
          />
        ))}
      </nav>
      <nav className="flex flex-col items-center gap-2 pb-2 flex-shrink-0">
        {renderWithBadge && (
          <NavButton
            item={renderWithBadge}
            isActive={activeScreen === "render"}
            onClick={() => onScreenChange("render")}
          />
        )}
        <NavButton
          item={settingsItem}
          isActive={activeScreen === "settings"}
          onClick={() => onScreenChange("settings")}
        />
      </nav>
    </aside>
  );
}
