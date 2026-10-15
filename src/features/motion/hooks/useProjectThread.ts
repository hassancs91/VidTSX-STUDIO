import { useEffect, useState } from 'react';
import { parseThread, type ThreadTurn } from '../services/project-thread';

/**
 * The open project's chat.json as a thread (P3 part 3). Read when the folder
 * changes and whenever `refreshKey` does — the screen bumps it when a job on
 * the folder ends, since every job writes its turns before it reports done.
 */
export function useProjectThread(folderPath: string | null, refreshKey: string): ThreadTurn[] {
  const [turns, setTurns] = useState<ThreadTurn[]>([]);

  useEffect(() => {
    if (!folderPath) {
      setTurns([]);
      return;
    }
    let disposed = false;
    window.api.fileRead({ path: `${folderPath.replace(/[\\/]+$/, '')}/chat.json` })
      .then((result) => {
        if (!disposed) setTurns(result.error ? [] : parseThread(result.content));
      })
      .catch(() => {
        if (!disposed) setTurns([]);
      });
    return () => { disposed = true; };
  }, [folderPath, refreshKey]);

  return turns;
}
