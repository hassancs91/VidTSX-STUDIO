import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import type {
  SttProvidersGetResponse,
  SttProvidersSaveRequest,
  SttProvidersSaveResponse,
  SttTranscribeCancelResponse,
  SttTranscribeRunRequest,
  SttTranscribeRunResponse,
} from '@shared/ipc/types/stt';
import { runSttTranscription, cancelSttTranscription } from '../../services/stt/run-transcription';
import { initSttEngine } from '../../services/stt/stt-init';
import { getSttProviders, saveSttProviders } from '../../services/settings';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('SttIpc');

export function registerSttIpc(): void {
  ipcMain.handle(
    IPC.STT_TRANSCRIBE_RUN,
    async (event: IpcMainInvokeEvent, req: SttTranscribeRunRequest): Promise<SttTranscribeRunResponse> => {
      try {
        if (!req?.inputPath) return { success: false, error: 'Input path is required' };
        if (!req?.sttModelId) return { success: false, error: 'Model is required' };

        const webContents = event.sender;
        const rich = await runSttTranscription(req, (phase, percent, message) => {
          if (!webContents.isDestroyed()) {
            webContents.send(IPC.STT_TRANSCRIBE_PROGRESS, { phase, percent, message });
          }
        });
        return { success: true, result: rich.result };
      } catch (err) {
        log.warn(`transcribe run failed: ${err instanceof Error ? err.message : String(err)}`);
        return { success: false, error: err instanceof Error ? err.message : 'Transcription failed' };
      }
    },
  );

  ipcMain.handle(IPC.STT_TRANSCRIBE_CANCEL, async (): Promise<SttTranscribeCancelResponse> => {
    return { success: cancelSttTranscription() };
  });

  ipcMain.handle(IPC.STT_PROVIDERS_GET, async (): Promise<SttProvidersGetResponse> => {
    try {
      const { providers, activeProvider } = await getSttProviders();
      // Strip stored keys — the renderer never sees raw credentials.
      const sanitized = providers.map((p) => ({ ...p, apiKey: '' }));
      return { success: true, providers: sanitized, activeProvider };
    } catch (err) {
      return {
        success: false,
        providers: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(
    IPC.STT_PROVIDERS_SAVE,
    async (_event, req: SttProvidersSaveRequest): Promise<SttProvidersSaveResponse> => {
      try {
        // Preserve existing stored keys when the incoming value is empty
        // (renderer always sends '' — keys live in providerCredentials).
        const { providers: existing } = await getSttProviders();
        const merged = req.providers.map((p) => {
          const prev = existing.find((e) => e.id === p.id);
          return { ...p, apiKey: p.apiKey || prev?.apiKey || '' };
        });
        await saveSttProviders(merged, req.activeProvider);
        await initSttEngine();
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  log.info('STT IPC handlers registered');
}
