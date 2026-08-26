// Import a `.vidtsx` package (Q7d/Q7f). Two steps on purpose: INSPECT reads
// the manifest and writes nothing, so the user sees what a package claims to
// be — including a refusal, when this build is too old to open it — before
// anything is unpacked. IMPORT then does the whole install and comes back with
// the report cards.
//
// The brand offer (Q7f) is resolved here rather than after the fact: the
// package's `settings.brandId` names a brand on someone else's machine, so the
// only honest options are match one of yours, create one from the tokens, or
// keep the tokens with the project.

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { TextInput } from '@shared/components/TextInput';
import { ProgressBar } from '@shared/components/ProgressBar';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import { Select } from '@shared/components/Select';
import type { StudioPackageBrandChoice, StudioPackageImportReport, StudioPackageInfo } from '@shared/ipc/types';
import { formatPackageBytes } from '@shared/studio/project-package';
import { useBrandList } from '../hooks/useBrandList';
import { usePackageProgress } from '../hooks/usePackageProgress';
import { ImportReportCards } from './ImportReportCards';

const STRATEGY_NOTE: Record<StudioPackageInfo['mediaStrategy'], string> = {
  full: 'Full media — self-contained.',
  'proxies-only': 'Proxies only — clips import as 720p stand-ins needing a full-res relink.',
  none: 'No media — you will be asked to locate each file after import.',
};

interface Props {
  isOpen: boolean;
  /** Skip the picker (double-clicked .vidtsx, or a path handed in). */
  filePath?: string;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
}

export function ImportPackageDialog({ isOpen, filePath, onClose, onOpenProject }: Props) {
  const brands = useBrandList();
  const [info, setInfo] = useState<StudioPackageInfo | null>(null);
  const [name, setName] = useState('');
  const [brandMode, setBrandMode] = useState<StudioPackageBrandChoice['mode']>('snapshot');
  const [matchBrandId, setMatchBrandId] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StudioPackageImportReport | null>(null);
  const progress = usePackageProgress('import', importing);

  useEffect(() => {
    if (!isOpen) {
      setInfo(null);
      setName('');
      setBrandMode('snapshot');
      setMatchBrandId('');
      setError(null);
      setReport(null);
      setImporting(false);
      return;
    }
    let cancelled = false;
    setInspecting(true);
    void (async () => {
      const res = await window.api.studioPackageInspect(filePath ? { filePath } : {});
      if (cancelled) return;
      setInspecting(false);
      if (res.canceled) {
        onClose();
        return;
      }
      if (!res.success || !res.info) {
        setError(res.error ?? 'Could not read that package.');
        return;
      }
      setInfo(res.info);
      setName(res.info.project.name);
      // A brand whose name already exists here is almost always the same
      // brand coming home — preselect the match rather than making a duplicate.
      const twin = brands.find(
        (brand) => brand.name.toLowerCase() === res.info?.brandSnapshot?.name.toLowerCase(),
      );
      if (twin) {
        setBrandMode('match');
        setMatchBrandId(twin.id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `brands` is a preselect nicety, not an input: re-running on its arrival
    // would re-open the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filePath]);

  const handleImport = useCallback(async () => {
    if (!info || importing) return;
    setImporting(true);
    setError(null);
    try {
      const brand: StudioPackageBrandChoice =
        brandMode === 'match' && matchBrandId
          ? { mode: 'match', brandId: matchBrandId }
          : brandMode === 'match'
            ? { mode: 'none' }
            : { mode: brandMode };
      const res = await window.api.studioPackageImport({
        filePath: info.filePath,
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(info.brandSnapshot ? { brand } : {}),
      });
      if (!res.success || !res.report) {
        setError(res.error ?? 'The package could not be imported.');
        return;
      }
      setReport(res.report);
    } finally {
      setImporting(false);
    }
  }, [info, name, brandMode, matchBrandId, importing]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={importing ? () => undefined : onClose}
      title="Import project package"
    >
      <div className="flex flex-col gap-4 w-[560px]" data-import-package-dialog>
        {error && <ErrorBanner message={error} />}
        {inspecting && <div className="text-[12px] text-text-dim">Reading package…</div>}

        {report ? (
          <>
            <ImportReportCards report={report} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => onOpenProject(report.projectId)}
                data-import-open-project
              >
                Open project
              </Button>
            </div>
          </>
        ) : (
          info && (
            <>
              <PackageSummary info={info} />

              {info.incompatible ? (
                <ErrorBanner message={info.incompatible} />
              ) : (
                <>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">
                      Import as
                    </span>
                    <TextInput
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={info.project.name}
                    />
                    <span className="text-[10px] text-text-dim">
                      Always a new project — an import never touches an existing one.
                    </span>
                  </label>

                  {info.brandSnapshot && (
                    <BrandOffer
                      brandName={info.brandSnapshot.name}
                      brands={brands}
                      mode={brandMode}
                      matchBrandId={matchBrandId}
                      onMode={setBrandMode}
                      onMatch={setMatchBrandId}
                    />
                  )}

                  {importing && (
                    <div className="flex flex-col gap-1.5">
                      <ProgressBar value={progress.percent} />
                      <span className="text-[11px] text-text-dim">
                        {progress.message || 'Importing…'}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={importing}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => void handleImport()}
                      disabled={importing}
                      data-import-package-confirm
                    >
                      {importing ? 'Importing…' : 'Import'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )
        )}
      </div>
    </Modal>
  );
}

function PackageSummary({ info }: { info: StudioPackageInfo }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[6px] bg-app-deep px-3 py-2.5"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-import-package-summary
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-text-primary truncate">
          {info.project.name}
        </span>
        <span className="text-[10px] text-text-muted tabular-nums shrink-0">
          {formatPackageBytes(info.totalBytes)}
        </span>
      </div>
      <div className="text-[10.5px] text-text-muted">
        {info.project.width}×{info.project.height} · {info.project.fps} fps ·{' '}
        {info.counts.assets} asset{info.counts.assets === 1 ? '' : 's'} · {info.counts.shots} shot
        {info.counts.shots === 1 ? '' : 's'} · {info.counts.transcripts} transcript
        {info.counts.transcripts === 1 ? '' : 's'}
      </div>
      <div className="text-[10.5px] text-text-dim">{STRATEGY_NOTE[info.mediaStrategy]}</div>
      <div className="text-[10px] text-text-ghost">
        Written by {info.app.name} {info.app.version}
        {info.kitVersion ? ` · kit ${info.kitVersion}` : ''}
        {info.captionPacks?.length ? ` · caption pack ${info.captionPacks.join(', ')}` : ''}
        {info.hasAgentChat ? ' · includes the assistant conversation' : ''}
      </div>
    </div>
  );
}

function BrandOffer({
  brandName,
  brands,
  mode,
  matchBrandId,
  onMode,
  onMatch,
}: {
  brandName: string;
  brands: Array<{ id: string; name: string }>;
  mode: StudioPackageBrandChoice['mode'];
  matchBrandId: string;
  onMode: (mode: StudioPackageBrandChoice['mode']) => void;
  onMatch: (brandId: string) => void;
}) {
  const options: Array<{ mode: StudioPackageBrandChoice['mode']; label: string; hint: string }> = [
    {
      mode: 'match',
      label: 'Use one of my brands',
      hint: 'The project generates against a brand already in your library.',
    },
    {
      mode: 'create',
      label: 'Create this brand',
      hint: 'Adds it to your library, available to every project.',
    },
    {
      mode: 'snapshot',
      label: 'Keep the tokens with the project',
      hint: 'Nothing is added to your library; this project reads its own brand.json.',
    },
    { mode: 'none', label: 'No brand', hint: 'Shots generate with the built-in palette.' },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">
        Brand — the package carries “{brandName}”
      </span>
      <div className="flex flex-col gap-1">
        {options.map((option) => (
          <label
            key={option.mode}
            className="flex items-start gap-2 cursor-pointer"
            data-import-brand-option={option.mode}
          >
            <input
              type="radio"
              name="import-brand"
              checked={mode === option.mode}
              onChange={() => onMode(option.mode)}
              disabled={option.mode === 'match' && brands.length === 0}
              className="mt-[3px]"
            />
            <span className="text-[11px] text-text-secondary">
              {option.label}
              <span className="block text-text-dim">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === 'match' && brands.length > 0 && (
        <div className="w-[220px] pl-5">
          <Select
            value={matchBrandId}
            onChange={onMatch}
            options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
          />
        </div>
      )}
    </div>
  );
}
