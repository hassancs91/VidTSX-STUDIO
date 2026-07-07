import { ContentPresetSettings, StylePresetSettings } from '../../PromptPresetSettings';
import { SectionHeader } from '../SectionHeader';

export function PresetsTab() {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <SectionHeader>Content Presets</SectionHeader>
        <div className="bg-app-surface rounded-lg p-3 border border-border">
          <ContentPresetSettings />
        </div>
      </div>
      <div>
        <SectionHeader>Style Presets</SectionHeader>
        <div className="bg-app-surface rounded-lg p-3 border border-border">
          <StylePresetSettings />
        </div>
      </div>
    </div>
  );
}
