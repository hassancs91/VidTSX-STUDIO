// What an import actually did (Q7d): one card per thing the user may still
// need to act on. Shots first — they are the part the D14 gate re-judged on
// this machine, and the only part with a button.
//
// A 'convert' verdict is the allowlist gap and nothing else, so Convert runs
// ONE pass that lands a new version in the same shot folder; an 'error'
// verdict says what needs a manual edit instead of pretending a button helps.

import { useState } from 'react';
import { AlertTriangle, Check, Link2, Package, Wand2 } from 'lucide-react';
import { Button } from '@shared/components/Button';
import type { StudioPackageImportReport } from '@shared/ipc/types';

interface Props {
  report: StudioPackageImportReport;
}

export function ImportReportCards({ report }: Props) {
  const shotsNeedingAttention = report.shots.filter((shot) => shot.verdict !== 'ready');
  const ready = report.shots.length - shotsNeedingAttention.length;

  return (
    <div className="flex flex-col gap-2.5" data-import-report>
      <div className="text-[12px] text-text-secondary">
        Imported as <span className="text-text-primary">{report.name}</span>
        {report.kind === 'template' && (
          <span className="ml-1.5 text-[10px] text-accent-amber">from a template package</span>
        )}
      </div>

      {report.shots.length > 0 && (
        <Card
          icon={<Check size={13} strokeWidth={1.5} />}
          tone={shotsNeedingAttention.length === 0 ? 'ok' : 'warn'}
          title={`${ready} of ${report.shots.length} shot${report.shots.length === 1 ? '' : 's'} passed the Studio gate`}
          note={
            shotsNeedingAttention.length === 0
              ? 'Every shot was re-checked on this machine.'
              : 'Shots are re-checked on import — the exporter’s machine proves nothing.'
          }
        />
      )}

      {shotsNeedingAttention.map((shot) => (
        <ShotCard key={shot.shotId} projectId={report.projectId} shot={shot} />
      ))}

      {report.relink.length > 0 && (
        <Card
          icon={<Link2 size={13} strokeWidth={1.5} />}
          tone="warn"
          title={`${report.relink.length} clip${report.relink.length === 1 ? '' : 's'} need${report.relink.length === 1 ? 's' : ''} relinking`}
          note={
            report.relink.some((item) => item.reason === 'proxy-only')
              ? 'Proxy stand-ins are in place. Open the project and use Locate… on each clip to swap in the full-res file.'
              : 'Open the project and use Locate… on each clip — picks are verified against the stored hash.'
          }
        >
          <div className="mt-1 flex flex-col gap-0.5">
            {report.relink.slice(0, 6).map((item) => (
              <div key={item.assetId} className="text-[10px] text-text-dim truncate">
                {item.name}
                {item.reason === 'proxy-only' ? ' · proxy in place' : ''}
              </div>
            ))}
            {report.relink.length > 6 && (
              <div className="text-[10px] text-text-dim">
                +{report.relink.length - 6} more
              </div>
            )}
          </div>
        </Card>
      )}

      {report.captionPacks.map((pack) => (
        <Card
          key={pack.packId}
          icon={<Package size={13} strokeWidth={1.5} />}
          tone={pack.installed ? 'ok' : 'warn'}
          title={
            pack.installed
              ? `Caption pack "${pack.packId}" installed`
              : `Caption pack "${pack.packId}" not installed`
          }
          note={pack.reason ?? 'Its templates are available to every project.'}
        />
      ))}

      {report.kit && (
        <Card
          icon={<Package size={13} strokeWidth={1.5} />}
          tone={report.kit.installed ? 'ok' : 'warn'}
          title={`Kit ${report.kit.version} ${report.kit.installed ? 'pinned to this project' : 'missing from the package'}`}
          note={
            report.kit.installed
              ? 'Shots render against the kit they were built with, not the installed one.'
              : 'Kit-using shots will fall back to the installed kit.'
          }
        />
      )}

      {report.brand.applied !== 'none' && (
        <Card
          icon={<Check size={13} strokeWidth={1.5} />}
          tone="ok"
          title={
            report.brand.applied === 'snapshot'
              ? 'Brand tokens kept with the project'
              : report.brand.applied === 'create'
                ? 'Brand created in your library'
                : 'Matched to one of your brands'
          }
          note={
            report.brand.applied === 'snapshot'
              ? 'Generation and captions read the project’s own brand.json.'
              : 'The project generates against this brand.'
          }
        />
      )}
      {report.preset.applied !== 'none' && (
        <div className="text-[10.5px] text-text-muted" data-import-report-preset>
          {report.preset.applied === 'create'
            ? 'Preset created in your library — the assistant follows it in this project.'
            : 'Matched to one of your presets — the assistant follows it in this project.'}
        </div>
      )}

      {report.warnings.map((warning) => (
        <Card
          key={warning}
          icon={<AlertTriangle size={13} strokeWidth={1.5} />}
          tone="warn"
          title={warning}
        />
      ))}
    </div>
  );
}

function ShotCard({
  projectId,
  shot,
}: {
  projectId: string;
  shot: StudioPackageImportReport['shots'][number];
}) {
  const [converting, setConverting] = useState(false);
  const [outcome, setOutcome] = useState<{ ok: boolean; message: string } | null>(null);

  const handleConvert = async (): Promise<void> => {
    setConverting(true);
    try {
      const res = await window.api.studioShotConform({ projectId, shotId: shot.shotId });
      setOutcome(
        res.success
          ? { ok: true, message: `Converted — now on v${res.version ?? '?'}.` }
          : { ok: false, message: res.error ?? 'The conversion failed.' },
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <Card
      icon={<Wand2 size={13} strokeWidth={1.5} />}
      tone={shot.verdict === 'convert' ? 'warn' : 'error'}
      title={shot.name}
      note={outcome ? outcome.message : shot.error}
      data-import-shot={shot.shotId}
    >
      {shot.verdict === 'convert' && !outcome?.ok && (
        <div className="mt-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleConvert()}
            disabled={converting}
            data-import-shot-convert={shot.shotId}
          >
            {converting ? 'Converting…' : 'Convert for Studio'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Card({
  icon,
  tone,
  title,
  note,
  children,
  ...rest
}: {
  icon: React.ReactNode;
  tone: 'ok' | 'warn' | 'error';
  title: string;
  note?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const color =
    tone === 'ok'
      ? 'var(--color-accent-green)'
      : tone === 'warn'
        ? 'var(--color-accent-amber)'
        : 'var(--color-accent-red)';
  return (
    <div
      className="flex gap-2 rounded-[6px] bg-app-deep px-2.5 py-2"
      style={{ border: '0.5px solid var(--color-border)' }}
      {...rest}
    >
      <span className="mt-[1px] shrink-0" style={{ color }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-text-primary">{title}</div>
        {note && <div className="text-[10.5px] text-text-dim leading-snug mt-0.5">{note}</div>}
        {children}
      </div>
    </div>
  );
}
