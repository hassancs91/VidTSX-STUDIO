import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { CaptureChip } from "./components/CaptureChip";
import { WorkspaceScreen, SelectedFileProvider } from "@features/workspace";
import { TranscriptionScreen } from "@features/transcription";
import { RenderScreen, RenderQueueProvider, useRenderQueue } from "@features/render-queue";
import { MotionScreen } from "@features/motion";
import { ImageStudioScreen } from "@features/image-studio";
import { VideoStudioScreen } from "@features/video-studio";
import { AssetLibraryScreen } from "@features/asset-library";
import { ToolsHubScreen } from "@features/tools";
import { AiModelsScreen } from "@features/ai-models";
import { FlowsScreen } from "@features/flows";
import { StudioScreen } from "@features/studio";
import { ToastProvider } from "./contexts/ToastContext";
import { OpenProjectProvider } from "./contexts/OpenProjectContext";
import { isFeatureEnabled } from "@shared/feature-flags";

const screens: Record<string, React.ComponentType> = {
  files: WorkspaceScreen,
  transcribe: TranscriptionScreen,
  render: RenderScreen,
  creator: MotionScreen,
  studio: StudioScreen,
  flows: FlowsScreen,
  'image-studio': ImageStudioScreen,
  'video-studio': VideoStudioScreen,
  assets: AssetLibraryScreen,
  tools: ToolsHubScreen,
  'ai-models': AiModelsScreen,
};

function AppContent({ activeScreen, setActiveScreen }: {
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
}) {
  const { activeCount } = useRenderQueue();
  const [visitedScreens, setVisitedScreens] = useState<Set<string>>(new Set(["creator"]));

  // Listen for cross-screen navigation events
  useEffect(() => {
    const handler = (e: Event) => {
      const { screen } = (e as CustomEvent<{ screen: string }>).detail;
      if (screen && screens[screen] && isFeatureEnabled(screen)) {
        setActiveScreen(screen);
      }
    };
    window.addEventListener('vidtsx:navigate', handler);
    return () => window.removeEventListener('vidtsx:navigate', handler);
  }, [setActiveScreen]);

  const resolvedActive = (isFeatureEnabled(activeScreen) ? activeScreen : "creator");

  useEffect(() => {
    setVisitedScreens(prev => {
      if (prev.has(resolvedActive)) return prev;
      return new Set(prev).add(resolvedActive);
    });
  }, [resolvedActive]);

  return (
    <div className="flex flex-col h-screen w-screen bg-app-base">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeScreen={activeScreen}
          onScreenChange={setActiveScreen}
          renderBadgeCount={activeCount}
        />
        <main className="flex-1 bg-app-base overflow-auto">
          {Array.from(visitedScreens).map(screenId => {
            const Screen = screens[screenId];
            if (!Screen) return null;
            const isActive = screenId === resolvedActive;
            return (
              <div
                key={screenId}
                style={{ display: isActive ? 'contents' : 'none' }}
              >
                <Screen />
              </div>
            );
          })}
        </main>
      </div>
      <StatusBar />
      <CaptureChip />
    </div>
  );
}

export function App() {
  const [activeScreen, setActiveScreen] = useState("creator");

  return (
    <ToastProvider>
      <RenderQueueProvider>
        <SelectedFileProvider>
          {/* Studio publishes the open project here; Assets reads it so AI
              organize can refuse to move what a live session references. */}
          <OpenProjectProvider>
            <AppContent
              activeScreen={activeScreen}
              setActiveScreen={setActiveScreen}
            />
          </OpenProjectProvider>
        </SelectedFileProvider>
      </RenderQueueProvider>
    </ToastProvider>
  );
}
