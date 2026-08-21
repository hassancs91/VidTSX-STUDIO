import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Which Studio project is currently OPEN in the editor, app-wide.
 *
 * This exists for one rule (ASSET_LIBRARY_DESIGN.md L7 Rev 2): AI organize
 * must never move a library file the open project references, because the
 * hash-heal that repairs a moved reference only runs on project OPEN. The
 * Assets screen therefore has to know what Studio has open — and every
 * visited screen stays mounted, so "open" really does outlive navigating
 * away from Studio.
 *
 * It lives at the renderer level rather than in either feature because
 * `asset-library` and `studio` must not import each other (house rule).
 * Main re-checks the same rule from this id before anything moves; the
 * renderer is not the authority on a safety rule, only the reporter of
 * what the user has on screen.
 */

interface OpenProjectContextValue {
  /** Studio project id, or null when the editor is on the project browser. */
  openProjectId: string | null;
  setOpenProjectId: (id: string | null) => void;
}

const OpenProjectContext = createContext<OpenProjectContextValue | null>(null);

export function OpenProjectProvider({ children }: { children: ReactNode }) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  // Q10 quit-flush: the main-process close guard waits for one flush ack.
  // With no Studio project open there is nothing to flush — ack immediately
  // so closing the window stays instant. When a project IS open, the editor's
  // own listener (useStudioProject) acks after its save lands, and this
  // fallback stays silent.
  const openRef = useRef<string | null>(null);
  openRef.current = openProjectId;
  useEffect(() => {
    return window.api.onStudioFlushRequest(() => {
      if (openRef.current === null) void window.api.studioFlushAck();
    });
  }, []);

  const value = useMemo(() => ({ openProjectId, setOpenProjectId }), [openProjectId]);
  return <OpenProjectContext.Provider value={value}>{children}</OpenProjectContext.Provider>;
}

export function useOpenProject(): OpenProjectContextValue {
  const context = useContext(OpenProjectContext);
  if (!context) {
    throw new Error('useOpenProject must be used within an OpenProjectProvider');
  }
  return context;
}
