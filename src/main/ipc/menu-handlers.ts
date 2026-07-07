import { Menu, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type {
  ContextMenuShowRequest,
  ContextMenuShowResponse,
  ContextMenuAction,
} from '../../shared/ipc/types';

export async function handleContextMenuShow(
  event: IpcMainInvokeEvent,
  data: ContextMenuShowRequest
): Promise<ContextMenuShowResponse> {
  return new Promise((resolve) => {
    const template: Electron.MenuItemConstructorOptions[] = [];

    if (data.target.type === 'file') {
      template.push(
        {
          label: 'Rename',
          click: () => resolve({ action: 'rename' }),
        },
        {
          label: 'Delete',
          click: () => resolve({ action: 'delete' }),
        }
      );
    } else {
      template.push(
        {
          label: 'Rename',
          click: () => resolve({ action: 'rename' }),
        },
        {
          label: 'Delete',
          click: () => resolve({ action: 'delete' }),
        },
        { type: 'separator' },
        {
          label: 'New subfolder',
          click: () => resolve({ action: 'new-subfolder' }),
        }
      );
    }

    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);

    menu.popup({
      window: win ?? undefined,
      callback: () => {
        // Menu closed without selection
        resolve({ action: null });
      },
    });
  });
}

export const menuHandlers = {
  handleContextMenuShow,
};
