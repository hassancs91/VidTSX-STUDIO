// @vidtsx/kit — VSCodeWindow: parameterized VS Code surface. Custom explorer
// trees (rows fade in / highlight on cues), multiple editor groups (split
// view), an animatable sidebar collapse, plus a typed code pane and an image
// viewer pane. Chrome colors stay faithful to real VS Code dark; the caller's
// accent shows up only where an extension/selection would (active-tab rule,
// row highlight, caret). Designed on a 1920×1080 canvas.
import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from 'remotion';
import { CLAMP, resolveTheme, type KitTheme } from './theme';
import { KitIcon, type KitIconName } from './icons';

/** VS Code dark chrome palette — app-faithful, exported so custom pane content
 *  can sit on the same surfaces without guessing hex values. */
export const VSCODE_COLORS = {
  chrome: '#181818', editor: '#1e1e1e', sidebar: '#181818', border: '#2b2b2b',
  text: '#cccccc', dim: '#8b8b8b', faint: '#6e6e6e', blue: '#3794ff', green: '#4ec98f',
  input: '#242424', inputBorder: '#3a3a3a',
} as const;
const V = VSCODE_COLORS;

/** Window geometry (px on 1920×1080): title height, activity-bar width,
 *  sidebar x/width, default editor x/width. */
export const VSCODE_LAYOUT = { TITLE_H: 44, ACT_W: 54, SB_X: 54, SB_W: 372, ED_X: 426, ED_W: 1494 } as const;
const VSC = VSCODE_LAYOUT;

/** Top of a group's content region (below tab bar + breadcrumb). */
export const GROUP_TOP = VSC.TITLE_H + 40 + 34;

// ---------------------------------------------------------------- explorer
export type ExplorerRow = {
  name: string;
  kind: 'folder' | 'file';
  depth?: number;
  open?: boolean;
  icon?: 'settings' | 'file' | 'braces' | 'image' | 'info';
  iconColor?: string;
  /** Git letter (U/M) shown at the right. */
  mark?: string | null;
  /** Green activity dot (folders). */
  dot?: boolean;
  /** Frame the row fades in (an expanding folder revealing children). */
  appearAt?: number;
  /** Frame the row gets the selected/highlight treatment. */
  highlightAt?: number;
};

const FILE_ICONS: Record<string, { icon: KitIconName; color: string }> = {
  settings: { icon: 'settings', color: V.dim },
  file: { icon: 'fileText', color: V.dim },
  braces: { icon: 'braces', color: '#c9a26b' },
  image: { icon: 'image', color: '#4ec98f' },
  info: { icon: 'info', color: '#4a9ee6' },
};

const ExplorerRowView: React.FC<{ row: ExplorerRow; frame: number; accent: string }> = ({ row, frame, accent }) => {
  const op = row.appearAt === undefined ? 1 : interpolate(frame, [row.appearAt, row.appearAt + 8], [0, 1], CLAMP);
  const hi = row.highlightAt === undefined ? 0 : interpolate(frame, [row.highlightAt, row.highlightAt + 8], [0, 1], CLAMP);
  const depth = row.depth ?? 0;
  const fi = FILE_ICONS[row.icon ?? 'file'];
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
      padding: `5px 14px 5px ${(row.kind === 'folder' ? 22 : 40) + depth * 18}px`, opacity: op,
    }}>
      {hi > 0 && <div style={{ position: 'absolute', inset: 0, background: `${accent}38`, borderLeft: `3px solid ${accent}`, opacity: hi }} />}
      {row.kind === 'folder' ? (
        <>
          {row.open
            ? <KitIcon name="chevronDown" size={15} color={V.dim} strokeWidth={2} />
            : <span style={{ color: V.dim, fontSize: 16, width: 12, position: 'relative' }}>›</span>}
          <KitIcon name={row.open ? 'folderOpen' : 'folder'} size={17} color="#c0a06a" strokeWidth={1.7} />
        </>
      ) : (
        <KitIcon name={fi.icon} size={17} color={row.iconColor ?? fi.color} strokeWidth={1.7} />
      )}
      <span style={{ fontSize: 18, color: hi > 0.5 ? '#fff' : V.text, flex: 1, position: 'relative', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
      {row.mark && <span style={{ fontSize: 15, color: V.green, fontWeight: 600, position: 'relative' }}>{row.mark}</span>}
      {row.kind === 'folder' && row.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: V.green, position: 'relative' }} />}
    </div>
  );
};

// ---------------------------------------------------------------- window
export type EditorGroup = {
  x: number;
  w: number;
  tab: { label: string; icon?: 'file' | 'image' | 'code'; appearAt?: number };
  breadcrumb?: string[];
  children?: React.ReactNode;
};

const ActIcon: React.FC<{ icon: KitIconName; active?: boolean; badge?: string }> = ({ icon, active, badge }) => (
  <div style={{ position: 'relative', width: VSC.ACT_W, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `2px solid ${active ? V.text : 'transparent'}` }}>
    <KitIcon name={icon} size={26} color={active ? V.text : V.faint} strokeWidth={1.6} />
    {badge && <span style={{ position: 'absolute', bottom: 8, right: 9, background: V.blue, color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 8, padding: '0 5px', lineHeight: '16px' }}>{badge}</span>}
  </div>
);

const TabIcon: React.FC<{ icon?: 'file' | 'image' | 'code' }> = ({ icon }) => {
  if (icon === 'image') return <KitIcon name="image" size={17} color="#4ec98f" />;
  if (icon === 'code') return <KitIcon name="braces" size={17} color="#c9a26b" />;
  return <KitIcon name="fileText" size={17} color={V.dim} />;
};

export const VSCodeWindow: React.FC<{
  rows: ExplorerRow[];
  groups: EditorGroup[];
  projectName?: string;
  /** Source-control badge count shown on the activity bar (omit for none). */
  gitBadge?: string;
  /** Animated sidebar width (px). Pass a frame-derived value to collapse the
   *  explorer Ctrl+B-style; content clips at the fixed width while closing. */
  sidebarW?: number;
  children?: React.ReactNode;
  theme?: Partial<KitTheme>;
}> = ({ rows, groups, projectName = 'my-project', gitBadge, sidebarW = VSC.SB_W, children, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  return (
    <AbsoluteFill style={{ backgroundColor: V.editor, fontFamily: t.fontBody }}>
      {/* title bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: VSC.TITLE_H, background: V.chrome, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${V.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingLeft: 16 }}>
          <div style={{ width: 24, height: 24, borderRadius: 5, background: V.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KitIcon name="chevronRight" size={14} color="#fff" strokeWidth={2.6} />
          </div>
          {['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'].map((m) => (
            <span key={m} style={{ fontSize: 18, color: V.text, opacity: 0.85 }}>{m}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10, width: 620, height: 30, background: '#2a2a2a', border: `1px solid ${V.border}`, borderRadius: 7, justifyContent: 'center' }}>
          <KitIcon name="search" size={16} color={V.faint} />
          <span style={{ fontSize: 17, color: V.dim }}>{projectName}</span>
        </div>
        <div style={{ position: 'absolute', right: 0, display: 'flex', alignItems: 'center', gap: 26, paddingRight: 22, color: V.dim, fontSize: 18 }}>
          <KitIcon name="layoutGrid" size={17} color={V.dim} /><span>—</span><span style={{ fontSize: 15 }}>▢</span><span>✕</span>
        </div>
      </div>
      {/* activity bar */}
      <div style={{ position: 'absolute', top: VSC.TITLE_H, left: 0, width: VSC.ACT_W, bottom: 0, background: V.chrome, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
          <ActIcon icon="files" active />
          <ActIcon icon="search" />
          <ActIcon icon="gitBranch" badge={gitBadge} />
          <ActIcon icon="play" />
          <ActIcon icon="layoutGrid" />
        </div>
        <KitIcon name="settings" size={26} color={V.faint} strokeWidth={1.6} />
      </div>
      {/* sidebar / explorer (width animatable; content stays fixed and clips) */}
      {sidebarW > 6 && (
        <div style={{ position: 'absolute', top: VSC.TITLE_H, left: VSC.SB_X, width: sidebarW, bottom: 0, background: V.sidebar, borderRight: `1px solid ${V.border}`, overflow: 'hidden' }}>
          <div style={{ width: VSC.SB_W, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 12px' }}>
              <span style={{ fontSize: 15, letterSpacing: 1, color: V.dim }}>EXPLORER</span>
              <KitIcon name="moreHorizontal" size={18} color={V.dim} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: V.text, padding: '6px 14px', letterSpacing: 0.4 }}>{projectName.toUpperCase()}</div>
            {rows.map((row, i) => <ExplorerRowView key={`${row.name}-${i}`} row={row} frame={frame} accent={t.accent} />)}
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: VSC.SB_W, borderTop: `1px solid ${V.border}`, background: V.sidebar }}>
            {['OUTLINE', 'TIMELINE'].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}><span style={{ color: V.dim }}>›</span><span style={{ fontSize: 15, letterSpacing: 1, color: V.dim }}>{s}</span></div>
            ))}
          </div>
        </div>
      )}
      {/* editor groups */}
      {groups.map((g, gi) => {
        const at = g.tab.appearAt ?? 0;
        const op = interpolate(frame, [at, at + 10], [0, 1], CLAMP);
        return (
          <React.Fragment key={gi}>
            {gi > 0 && <div style={{ position: 'absolute', top: VSC.TITLE_H, left: g.x, bottom: 0, width: 1, background: V.border, zIndex: 2 }} />}
            {/* tab bar */}
            <div style={{ position: 'absolute', top: VSC.TITLE_H, left: g.x, width: g.w, height: 40, background: V.chrome, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%', padding: '0 20px', background: V.editor, borderTop: `1px solid ${t.accent}`, borderRight: `1px solid ${V.border}`, opacity: op }}>
                <TabIcon icon={g.tab.icon} />
                <span style={{ fontSize: 18, color: V.text, whiteSpace: 'nowrap' }}>{g.tab.label}</span>
                <KitIcon name="x" size={17} color={V.dim} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingRight: 20 }}>
                {gi === groups.length - 1 && <KitIcon name="splitSquare" size={18} color={V.dim} />}
                <KitIcon name="moreHorizontal" size={18} color={V.dim} />
              </div>
            </div>
            {/* breadcrumb */}
            <div style={{ position: 'absolute', top: VSC.TITLE_H + 40, left: g.x, width: g.w, height: 34, background: V.editor, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', borderBottom: `1px solid ${V.border}`, opacity: op }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                {(g.breadcrumb ?? ['Untitled']).map((b, bi) => (
                  <React.Fragment key={bi}>
                    {bi > 0 && <KitIcon name="chevronRight" size={14} color={V.faint} />}
                    <span style={{ fontSize: 17, color: V.dim, whiteSpace: 'nowrap' }}>{b}</span>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <KitIcon name="clock" size={16} color={V.dim} />
                <KitIcon name="plus" size={16} color={V.dim} />
              </div>
            </div>
            {g.children}
          </React.Fragment>
        );
      })}
      {children}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- image viewer pane
export const ImageViewerPane: React.FC<{
  x: number; w: number; src: string; openAt?: number; imgW?: number; imgH?: number; caption?: string;
  theme?: Partial<KitTheme>;
}> = ({ x, w, src, openAt = 0, imgW = 560, imgH, caption, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const op = interpolate(frame, [openAt, openAt + 12], [0, 1], CLAMP);
  const sc = interpolate(frame, [openAt, openAt + 16], [0.96, 1], CLAMP);
  const checker = {
    backgroundImage:
      'linear-gradient(45deg, #262626 25%, transparent 25%), linear-gradient(-45deg, #262626 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #262626 75%), linear-gradient(-45deg, transparent 75%, #262626 75%)',
    backgroundSize: '26px 26px',
    backgroundPosition: '0 0, 0 13px, 13px -13px, -13px 0',
  } as const;
  return (
    <div style={{ position: 'absolute', top: GROUP_TOP, left: x, width: w, bottom: 0, background: V.editor, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: op }}>
      <div style={{ position: 'relative', transform: `scale(${sc})` }}>
        <div style={{ ...checker, position: 'absolute', inset: -18, borderRadius: 4, background: '#1a1a1a' }} />
        <Img src={src} style={{ position: 'relative', width: imgW, height: imgH, display: 'block', boxShadow: '0 18px 60px rgba(0,0,0,0.5)' }} />
      </div>
      <div style={{ position: 'absolute', right: 22, bottom: 18, fontFamily: t.fontMono, fontSize: 17, color: V.dim, background: '#252525', border: `1px solid ${V.border}`, borderRadius: 6, padding: '4px 12px' }}>
        {caption ?? '100%'}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- typed code pane
export type CodeSeg = [text: string, color: string];
export type CodeLine = CodeSeg[];

/** Editor pane with line numbers; characters write on left-to-right across all
 *  lines. `cps` = characters per second at 30fps; large values = fast writing. */
export const CodeEditorPane: React.FC<{
  x: number; w: number; lines: CodeLine[]; typeStart?: number; cps?: number;
  fontSize?: number; appearAt?: number;
  theme?: Partial<KitTheme>;
}> = ({ x, w, lines, typeStart = 10, cps = 30, fontSize = 26, appearAt = 0, theme }) => {
  const frame = useCurrentFrame();
  const t = resolveTheme(theme);
  const paneOp = interpolate(frame, [appearAt, appearAt + 8], [0, 1], CLAMP);
  const shown = Math.max(0, Math.floor((frame - typeStart) * (cps / 30)));
  let used = 0;
  const lineH = fontSize * 1.62;
  const done = shown >= lines.reduce((n, l) => n + l.reduce((m, s) => m + s[0].length, 0), 0);
  const cursorOn = Math.floor(frame / 14) % 2 === 0;
  return (
    <div style={{ position: 'absolute', top: GROUP_TOP, left: x, width: w, bottom: 0, background: V.editor, padding: '18px 0', opacity: paneOp, overflow: 'hidden' }}>
      {lines.map((line, li) => {
        const chars = line.reduce((n, s) => n + s[0].length, 0);
        const from = used;
        used += chars;
        const visible = Math.max(0, Math.min(chars, shown - from));
        let left = visible;
        const isCursorLine = !done && shown >= from && shown < from + chars + 1;
        return (
          <div key={li} style={{ display: 'flex', height: lineH, alignItems: 'center' }}>
            <span style={{ width: 78, textAlign: 'right', paddingRight: 26, fontFamily: t.fontMono, fontSize: fontSize - 5, color: '#5a5a5a', flexShrink: 0 }}>{li + 1}</span>
            <span style={{ fontFamily: t.fontMono, fontSize, whiteSpace: 'pre' }}>
              {line.map((seg, si) => {
                const take = Math.max(0, Math.min(seg[0].length, left));
                left -= take;
                return <span key={si} style={{ color: seg[1] }}>{seg[0].slice(0, take)}</span>;
              })}
              {isCursorLine && <span style={{ color: t.accent, opacity: cursorOn ? 1 : 0 }}>▌</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
};
