// One-shot migration: split src/renderer/components/SettingsScreen.tsx into
// a folder of focused sub-components. Master entry stays import-compatible
// because Node/TS module resolution picks SettingsScreen/index.ts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const srcFile = path.join(repoRoot, 'src/renderer/components/SettingsScreen.tsx');
const outDir = path.join(repoRoot, 'src/renderer/components/SettingsScreen');

const raw = fs.readFileSync(srcFile, 'utf8');
const lines = raw.split(/\r?\n/);
const slice = (start, end) => lines.slice(start - 1, end).join('\n');

// Helper: ensure every function declaration in a body is exported.
const exportify = (body) =>
  body.replace(/^function (\w+)/gm, 'export function $1');

if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(outDir, 'rows'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'tabs'), { recursive: true });

// ─── SectionHeader.tsx ───
fs.writeFileSync(
  path.join(outDir, 'SectionHeader.tsx'),
  `${exportify(slice(16, 22))}\n`,
);

// ─── LicenseSection.tsx (lines 25-148) ───
const licenseSection =
  `import { useState } from 'react';\n` +
  `import { Button, Badge, TextInput } from '@shared/components';\n` +
  `import { useLicenseContext } from '../../contexts/LicenseContext';\n` +
  `import { formatLicenseInput } from '../../hooks/useLicense';\n\n` +
  `${exportify(slice(25, 148))}\n`;
fs.writeFileSync(path.join(outDir, 'LicenseSection.tsx'), licenseSection);

// ─── AppInfoSection.tsx (lines 476-536) ───
const appInfoSection =
  `import { Button } from '@shared/components';\n` +
  `import { useUpdaterContext } from '../../contexts/UpdaterContext';\n\n` +
  `${exportify(slice(476, 536))}\n`;
fs.writeFileSync(path.join(outDir, 'AppInfoSection.tsx'), appInfoSection);

// ─── rows/RenderTimeoutRow.tsx (lines 160-226) ───
const renderTimeoutRow =
  `import { useState, useEffect } from 'react';\n` +
  `import { TextInput } from '@shared/components';\n\n` +
  `${exportify(slice(160, 226))}\n`;
fs.writeFileSync(path.join(outDir, 'rows/RenderTimeoutRow.tsx'), renderTimeoutRow);

// ─── rows/CpuUsageDefaultRow.tsx (lines 228-268) ───
const cpuUsageRow =
  `import type { RenderCpuUsage } from '@shared/ipc/types';\n\n` +
  `${exportify(slice(228, 268))}\n`;
fs.writeFileSync(path.join(outDir, 'rows/CpuUsageDefaultRow.tsx'), cpuUsageRow);

// ─── rows/GpuBackendDefaultRow.tsx (lines 270-307) ───
const gpuBackendRow =
  `import { GPU_BACKEND_OPTIONS } from '@shared/components/RenderSettingsModal';\n` +
  `import type { RenderGpuBackend } from '@shared/ipc/types';\n\n` +
  `${exportify(slice(270, 307))}\n`;
fs.writeFileSync(path.join(outDir, 'rows/GpuBackendDefaultRow.tsx'), gpuBackendRow);

// ─── rows/HardwareAccelerationDefaultRow.tsx (lines 309-346) ───
const hwAccelRow =
  `import { HARDWARE_ACCELERATION_OPTIONS } from '@shared/components/RenderSettingsModal';\n` +
  `import type { RenderHardwareAcceleration } from '@shared/ipc/types';\n\n` +
  `${exportify(slice(309, 346))}\n`;
fs.writeFileSync(path.join(outDir, 'rows/HardwareAccelerationDefaultRow.tsx'), hwAccelRow);

// ─── tabs/GeneralTab.tsx (lines 348-474) ───
const generalTab =
  `import { Button } from '@shared/components';\n` +
  `import type { RenderCpuUsage, RenderGpuBackend, RenderHardwareAcceleration } from '@shared/ipc/types';\n` +
  `import { SectionHeader } from '../SectionHeader';\n` +
  `import { LicenseSection } from '../LicenseSection';\n` +
  `import { AppInfoSection } from '../AppInfoSection';\n` +
  `import { RenderTimeoutRow } from '../rows/RenderTimeoutRow';\n` +
  `import { CpuUsageDefaultRow } from '../rows/CpuUsageDefaultRow';\n` +
  `import { GpuBackendDefaultRow } from '../rows/GpuBackendDefaultRow';\n` +
  `import { HardwareAccelerationDefaultRow } from '../rows/HardwareAccelerationDefaultRow';\n\n` +
  `${exportify(slice(348, 474))}\n`;
fs.writeFileSync(path.join(outDir, 'tabs/GeneralTab.tsx'), generalTab);

// ─── tabs/ProvidersTab.tsx (lines 538-585) ───
const providersTab =
  `import { useState } from 'react';\n` +
  `import { ProviderSettings } from '../../ProviderSettings';\n` +
  `import { ImageProviderSettings } from '../../ImageProviderSettings';\n` +
  `import { AiUsageDashboard } from '../../AiUsageDashboard';\n` +
  `import { SectionHeader } from '../SectionHeader';\n\n` +
  `${slice(538, 543)}\n\n` +
  `${exportify(slice(545, 585))}\n`;
fs.writeFileSync(path.join(outDir, 'tabs/ProvidersTab.tsx'), providersTab);

// ─── tabs/TranscriptionTab.tsx (lines 587-816) ───
// Includes inline CheckIcon, XIcon, formatSpeed, formatEta, WhisperDownloadInfo.
const transcriptionTab =
  `import { Button, ProgressBar } from '@shared/components';\n` +
  `import { SectionHeader } from '../SectionHeader';\n\n` +
  `${slice(587, 619)}\n\n` +
  `${exportify(slice(621, 816))}\n`;
fs.writeFileSync(path.join(outDir, 'tabs/TranscriptionTab.tsx'), transcriptionTab);

// ─── tabs/PresetsTab.tsx (lines 818-835) ───
const presetsTab =
  `import { ContentPresetSettings, StylePresetSettings } from '../../PromptPresetSettings';\n` +
  `import { SectionHeader } from '../SectionHeader';\n\n` +
  `${exportify(slice(818, 835))}\n`;
fs.writeFileSync(path.join(outDir, 'tabs/PresetsTab.tsx'), presetsTab);

// ─── SettingsScreen.tsx (main coordinator, lines 839-943 + TABS const at 150-158) ───
const main =
  `import { useState } from 'react';\n` +
  `import { useSettings } from '../../hooks/useSettings';\n` +
  `import { useWhisper } from '../../hooks/useWhisper';\n` +
  `import { GeneralTab } from './tabs/GeneralTab';\n` +
  `import { ProvidersTab } from './tabs/ProvidersTab';\n` +
  `import { TranscriptionTab } from './tabs/TranscriptionTab';\n\n` +
  `${slice(150, 158)}\n\n` +
  `${slice(839, 943)}\n`;
fs.writeFileSync(path.join(outDir, 'SettingsScreen.tsx'), main);

// ─── index.ts barrel ───
fs.writeFileSync(
  path.join(outDir, 'index.ts'),
  `export { SettingsScreen } from './SettingsScreen';\n`,
);

// Remove old flat file
fs.unlinkSync(srcFile);

console.log(`Wrote SettingsScreen folder with sub-components`);
