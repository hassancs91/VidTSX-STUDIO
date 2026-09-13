import { Modal } from '@shared/components/Modal';
import type { StudioProject } from '../types';
import type { BrandOption } from '../hooks/useBrandList';
import type { PresetOption } from '../hooks/usePresetList';
import type { ProjectBrandState } from '../hooks/useProjectBrand';
import { ProjectFormatFields } from './ProjectFormatFields';
import { ProjectBrandFields } from './ProjectBrandFields';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: StudioProject;
  onUpdate: (updater: (prev: StudioProject) => StudioProject) => void;
  brands: BrandOption[];
  onSetBrand: (brandId: string | null) => void;
  presets: PresetOption[];
  onSetPreset: (presetId: string | null) => void;
  projectBrand: ProjectBrandState;
}

function SectionTitle({ children }: { children: string }) {
  return <div className="text-[10px] uppercase tracking-wider text-text-muted">{children}</div>;
}

/**
 * Project settings (video-10 feedback item 7.4), opened from the top bar next
 * to Export: the project-level settings in one place: name, frame size, fps,
 * STT model, and the Brand + Preset that used to hide in the media pool.
 * Every change lands in the document at once (autosaved, not undoable).
 */
export function ProjectSettingsDialog({
  isOpen,
  onClose,
  project,
  onUpdate,
  brands,
  onSetBrand,
  presets,
  onSetPreset,
  projectBrand,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Project settings">
      <div className="w-[460px] max-h-[70vh] overflow-y-auto flex flex-col gap-4" data-project-settings>
        <section className="flex flex-col gap-2">
          <SectionTitle>Project</SectionTitle>
          <ProjectFormatFields project={project} onUpdate={onUpdate} />
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>Brand and preset</SectionTitle>
          <ProjectBrandFields
            brands={brands}
            brandId={project.settings.brandId}
            onSetBrand={onSetBrand}
            presets={presets}
            presetId={project.settings.presetId}
            onSetPreset={onSetPreset}
            projectBrand={projectBrand}
            onLeave={onClose}
          />
        </section>
      </div>
    </Modal>
  );
}
