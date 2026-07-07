import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  SkillsListResponse,
} from '../../shared/ipc/types';

export const skillsApi = {
  // ─── Skills registry ───
  // Skills registry
  skillsList: (): Promise<SkillsListResponse> =>
    ipcRenderer.invoke(IPC.SKILLS_LIST),
};
