import { useState, useCallback, useEffect, useRef } from 'react';
import { createRendererLogger } from '../../../renderer/utils/logger';

const log = createRendererLogger('Prototyper');
import { usePrototyperChat } from '../hooks/usePrototyperChat';
import { usePrototyperProject } from '../hooks/usePrototyperProject';
import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { PrototyperLibraryPanel } from './PrototyperLibraryPanel';

export function PrototyperScreen() {
  const chat = usePrototyperChat();
  const projectManager = usePrototyperProject();
  const [currentHtml, setCurrentHtml] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);
  const lastSyncedVersion = useRef<string | null>(null);
  const projectCreated = useRef(false);

  // Sync html/chat when project changes (e.g., from library load)
  useEffect(() => {
    if (!projectManager.project) return;
    if (lastSyncedVersion.current === projectManager.project.currentVersion) return;

    lastSyncedVersion.current = projectManager.project.currentVersion;
    setCurrentHtml(projectManager.project.currentHtml);
    chat.loadChat(projectManager.project.chatHistory);
  }, [projectManager.project, chat]);

  const handleSend = useCallback(async (text: string) => {
    const result = await chat.sendMessage(text);

    if (!result.htmlCode) {
      log.warn('No HTML code extracted from response');
      return;
    }

    setCurrentHtml(result.htmlCode);

    try {
      if (!projectCreated.current) {
        log.debug('Creating new project...');
        const created = await projectManager.createProject(result.htmlCode, result.chatHistory);
        if (created) {
          projectCreated.current = true;
          lastSyncedVersion.current = created.currentVersion;
          log.debug('Project created', { folderPath: created.folderPath });
        } else {
          log.error('createProject returned null — check projectManager.error');
        }
      } else {
        log.debug('Saving new version...');
        const versionPath = await projectManager.saveNewVersion(result.htmlCode, result.chatHistory);
        if (versionPath) {
          lastSyncedVersion.current = versionPath;
          log.debug('Version saved', { versionPath });
        } else {
          log.error('saveNewVersion returned null — check projectManager.error');
        }
      }
    } catch (err) {
      log.error('Save error', err);
    }
  }, [chat, projectManager]);

  const handleNewChat = useCallback(() => {
    chat.clearChat();
    projectManager.resetProject();
    setCurrentHtml('');
    lastSyncedVersion.current = null;
    projectCreated.current = false;
  }, [chat, projectManager]);

  const handleHtmlChange = useCallback((html: string) => {
    setCurrentHtml(html);
  }, []);

  const handleSaveCode = useCallback(async () => {
    if (projectManager.project && currentHtml) {
      await projectManager.overwriteVersion(currentHtml);
    }
  }, [projectManager, currentHtml]);

  // Combine errors from chat and project manager
  const combinedError = chat.error || projectManager.error;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center px-4 py-2 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <h1 className="text-[13px] font-semibold text-text-primary">Prototyper</h1>
        {projectManager.project && (
          <span className="ml-3 text-[11px] text-text-muted">
            {projectManager.project.name}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className={`text-[11px] px-2 py-1 rounded-[6px] transition-colors ${
            showLibrary
              ? 'bg-accent text-white'
              : 'text-text-muted hover:bg-app-hover hover:text-text-primary'
          }`}
        >
          Library
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Chat panel */}
        <div className="w-[380px] shrink-0">
          <ChatPanel
            chatHistory={chat.chatHistory}
            loading={chat.loading}
            error={combinedError}
            providers={chat.providers}
            selectedProvider={chat.selectedProvider}
            onProviderChange={chat.setSelectedProvider}
            thinkingLevel={chat.thinkingLevel}
            onThinkingChange={chat.setThinkingLevel}
            onSend={handleSend}
            onNewChat={handleNewChat}
          />
        </div>

        {/* Preview panel */}
        <div className="flex-1 min-w-0">
          <PreviewPanel
            html={currentHtml}
            onHtmlChange={handleHtmlChange}
            onSave={handleSaveCode}
            onScreenshot={projectManager.saveScreenshot}
            onRecordStart={projectManager.startRecording}
            onRecordStop={projectManager.stopRecording}
          />
        </div>

        {/* Library panel (toggle-able) */}
        {showLibrary && (
          <div
            className="w-[240px] shrink-0"
            style={{ borderLeft: '0.5px solid var(--color-border)' }}
          >
            <PrototyperLibraryPanel
              library={projectManager.library}
              activeProjectPath={projectManager.project?.folderPath || null}
              activeVersionPath={projectManager.project?.currentVersion || null}
              onLoadVersion={projectManager.loadVersion}
              onRenameProject={projectManager.renameProject}
              onDeleteProject={projectManager.deleteProject}
            />
          </div>
        )}
      </div>
    </div>
  );
}
