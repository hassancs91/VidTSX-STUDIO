import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { SettingsScreen } from "./components/SettingsScreen";
import { WorkspaceScreen, SelectedFileProvider } from "@features/workspace";
import { TranscriptionScreen } from "@features/transcription";
import { RenderScreen, RenderQueueProvider, useRenderQueue } from "@features/render-queue";
import { StudioScreen } from "@features/studio";
import { MotionScreen } from "@features/motion";
import { PrototyperScreen } from "@features/prototyper";
import { HomeScreen } from "@features/home/components/HomeScreen";
import { ImageStudioScreen } from "@features/image-studio";
import { VideoStudioScreen } from "@features/video-studio";
import { AssetLibraryScreen } from "@features/asset-library";
import { ToolsHubScreen } from "@features/tools";
import { WhiteboardScreen } from "@features/whiteboard";
import { FlowsScreen } from "@features/flows";
import { ToastProvider } from "./contexts/ToastContext";
import { LicenseProvider } from "./contexts/LicenseContext";
import { UpdaterProvider } from "./contexts/UpdaterContext";
import { isFeatureEnabled } from "@shared/feature-flags";

const screens: Record<string, React.ComponentType> = {
  home: HomeScreen,
  files: WorkspaceScreen,
  studio: StudioScreen,
  transcribe: TranscriptionScreen,
  render: RenderScreen,
  creator: MotionScreen,
  whiteboard: WhiteboardScreen,
  flows: FlowsScreen,
  prototyper: PrototyperScreen,
  'image-studio': ImageStudioScreen,
  'video-studio': VideoStudioScreen,
  assets: AssetLibraryScreen,
  tools: ToolsHubScreen,
  settings: SettingsScreen,
};

function AppContent({ activeScreen, setActiveScreen }: {
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
}) {
  const { activeCount } = useRenderQueue();
  const [visitedScreens, setVisitedScreens] = useState<Set<string>>(new Set(["home"]));

  // Listen for cross-screen navigation events
  useEffect(() => {
    const handler = (e: Event) => {
      const { screen } = (e as CustomEvent<{ screen: string }>).detail;
      if (screen && screens[screen]) {
        setActiveScreen(screen);
      }
    };
    window.addEventListener('vidtsx:navigate', handler);
    return () => window.removeEventListener('vidtsx:navigate', handler);
  }, [setActiveScreen]);

  const resolvedActive = (isFeatureEnabled(activeScreen) ? activeScreen : "home");

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
    </div>
  );
}

export function App() {
  const [activeScreen, setActiveScreen] = useState("home");

  return (
    <ToastProvider>
      <LicenseProvider>
        <UpdaterProvider>
          <RenderQueueProvider>
            <SelectedFileProvider>
              <AppContent
                activeScreen={activeScreen}
                setActiveScreen={setActiveScreen}
              />
            </SelectedFileProvider>
          </RenderQueueProvider>
        </UpdaterProvider>
      </LicenseProvider>
    </ToastProvider>
  );
}
