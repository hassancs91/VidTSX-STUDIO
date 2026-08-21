// @vidtsx/kit — public surface. Everything a shot may import from the kit is
// re-exported here; the module server bundles this entry into the single
// virtual module served to the preview and the export bundler.
export { EASINGS } from './easings';
export { CLAMP, DARK, DEFAULT_THEME, resolveTheme, type KitTheme } from './theme';
export { TypedText, typeDuration } from './typed-text';
export { GenericWindow, WINDOW_TITLE_H } from './window';
export { TerminalWindow, type TermLine } from './terminal';
export { StatBlock, type StatItem } from './stat-block';
export {
  VSCodeWindow,
  ImageViewerPane,
  CodeEditorPane,
  GROUP_TOP,
  VSCODE_COLORS,
  VSCODE_LAYOUT,
  type ExplorerRow,
  type EditorGroup,
  type CodeLine,
  type CodeSeg,
} from './vscode';
export { AgentFeed, AgentInputDock, type FeedLine } from './agent-feed';
export { KitIcon, type KitIconName } from './icons';
