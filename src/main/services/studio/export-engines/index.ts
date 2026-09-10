/**
 * Export engines — public surface for the IPC layer.
 * Registration happens once at startup (`initExportEngines`), like the
 * LLM / image / STT engines; the built-in Remotion engine is always present.
 */
import { logEngine } from '../../../../logging/log-engine';
import { registerExportEngine, hasExportEngine, listExportEngineIds } from './registry';
import { remotionExportEngine } from './remotion-engine';
import { passthroughExportEngine } from './passthrough-engine';

const log = logEngine.createLogger('ExportEngines');

export function initExportEngines(): void {
  if (!hasExportEngine(remotionExportEngine.id)) registerExportEngine(remotionExportEngine);
  // Stage 2: the passthrough hybrid. Registered always; its availability()
  // greys the picker row out until the full ffmpeg download is installed.
  if (!hasExportEngine(passthroughExportEngine.id)) registerExportEngine(passthroughExportEngine);
  log.info('Export engines registered', { engines: listExportEngineIds() });
}

export { readExportContext, writeExportContext } from './export-context';
export { hasExportEngine, listExportEngineIds, listExportEngineStatus, resolveExportEngine } from './registry';
export { cancelStudioExport, isExportVerifyAvailable, isStudioExportActive, runStudioExport, sweepExportScratch } from './run-export';
export type { StudioExportResult, StudioExportRunOptions } from './run-export';
export { EXPORT_COLOR } from './types';
export type { ExportEngine, ExportEngineInput, ExportEngineProduct, ExportRenderSettings } from './types';
