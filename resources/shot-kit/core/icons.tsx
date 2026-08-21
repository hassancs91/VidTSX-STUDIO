// @vidtsx/kit — internal stroke-icon set for the fake app chromes. Hand-drawn
// simple geometry on a 24×24 grid; these decorate chrome at 15–26 px, so
// silhouettes matter, not detail. No icon library dependency on purpose — kit
// code may import only 'react' and 'remotion'.
import React from 'react';

const PATHS: Record<string, React.ReactNode> = {
  arrowLeft: <path d="M20 12H6 M11 6l-6 6 6 6" />,
  arrowRight: <path d="M4 12h14 M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 20V6 M6 11l6-6 6 6" />,
  rotateCw: <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1L20.5 8 M20.5 3.5V8h-4.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9z" />,
  moreVertical: (
    <>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  moreHorizontal: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  plus: <path d="M12 5v14 M5 12h14" />,
  x: <path d="M6 6l12 12 M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.2 16.2 21 21" />
    </>
  ),
  files: (
    <>
      <rect x="8" y="3" width="12" height="15" rx="2" />
      <path d="M4 7v12a2 2 0 0 0 2 2h10" />
    </>
  ),
  gitBranch: (
    <>
      <circle cx="6" cy="5" r="2.4" />
      <circle cx="6" cy="19" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <path d="M6 7.4v9.2 M18 9.4a8 8 0 0 1-8 7.6" />
    </>
  ),
  play: <path d="M8 5.5l11 6.5-11 6.5z" />,
  layoutGrid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  folderOpen: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1" />
      <path d="M4.5 20 6 10h15.5L20 20z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M18.7 5.3l-2.1 2.1 M7.4 16.6l-2.1 2.1" />
    </>
  ),
  fileText: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4 M9 12h6 M9 16h6" />
    </>
  ),
  braces: <path d="M9 4c-2 0-2.5 1.2-2.5 3v2c0 1.5-.7 2.5-2 3 1.3.5 2 1.5 2 3v2c0 1.8.5 3 2.5 3 M15 4c2 0 2.5 1.2 2.5 3v2c0 1.5.7 2.5 2 3-1.3.5-2 1.5-2 3v2c0 1.8-.5 3-2.5 3" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M4.5 18.5 10 13l3 3 3.5-3.5 3 3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5 M12 7.4v.2" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  mic: (
    <>
      <rect x="9.2" y="3" width="5.6" height="11" rx="2.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0 M12 18v3.5" />
    </>
  ),
  slash: <path d="M17 5 7 19" />,
  zap: <path d="M13 2 4.5 13.5H11L9.5 22 18.5 10H12z" />,
  square: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  splitSquare: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M12 5v14" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18" />
    </>
  ),
};

export type KitIconName = keyof typeof PATHS;

export const KitIcon: React.FC<{
  name: KitIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
  style?: React.CSSProperties;
}> = ({ name, size = 18, color = 'currentColor', strokeWidth = 1.8, fill = false, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill ? color : 'none'}
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0, ...style }}
  >
    {PATHS[name]}
  </svg>
);
