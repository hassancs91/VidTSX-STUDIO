// One installed agent in the gallery (agents plan §1.7).
//
// Card menu: Open, Details, Check for update, Remove. "Check for update" is
// absent when the manifest declares no `updateUrl` — the app has nothing to
// fetch and a dead menu item would suggest otherwise. Remove is absent for a
// built-in, which is read-only.

import { useState } from 'react';
import { Bot, Download, Info, MoreVertical, Trash2 } from 'lucide-react';
import type { InstalledAgent } from '@shared/types/agents';
import { trustTagFor } from '../services/manifest-summary';
import { TrustBadge } from './TrustBadge';

interface Props {
  agent: InstalledAgent;
  onOpen: () => void;
  onDetails: () => void;
  onCheckUpdate: () => void;
  onRemove: () => void;
}

export function AgentCard({ agent, onOpen, onDetails, onCheckUpdate, onRemove }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { manifest, origin, update } = agent;
  const tag = trustTagFor(agent);

  return (
    <div
      className="relative rounded-[8px] bg-app-surface overflow-hidden transition-colors hover:border-[#444]"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <button onClick={onOpen} className="w-full text-left" title={`Open ${manifest.name}`}>
        <div className="flex items-center justify-center h-[80px] bg-accent-purple-bg" style={{ backgroundColor: '#1e1030' }}>
          {agent.iconUrl ? (
            <img
              src={agent.iconUrl}
              alt=""
              className="w-[40px] h-[40px] rounded-[8px] object-contain"
            />
          ) : (
            <Bot size={26} strokeWidth={1.25} className="text-accent-light" />
          )}
        </div>
        <div className="px-2 py-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] font-medium text-text-primary truncate">{manifest.name}</span>
            <span className="text-[10px] text-text-dim shrink-0">{manifest.version}</span>
          </div>
          <div className="text-[10px] text-text-dim truncate mt-[1px]">{manifest.description}</div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <TrustBadge tag={tag} />
            {origin === 'user' && (
              <span className="text-[9px] text-text-ghost">{manifest.author.name}</span>
            )}
          </div>
          {update ? (
            <div className="mt-1.5 text-[9px] text-accent-light">
              {update.compatible
                ? `Version ${update.version} is available`
                : `Version ${update.version} needs VidTSX ${update.minAppVersion}`}
            </div>
          ) : null}
        </div>
      </button>

      <button
        onClick={() => setMenuOpen((v) => !v)}
        title="More"
        className="absolute top-1 right-1 flex items-center justify-center w-[22px] h-[22px] rounded-[5px] bg-black/40 text-text-muted hover:text-text-primary"
      >
        <MoreVertical size={12} strokeWidth={1.75} />
      </button>

      {menuOpen ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute top-[26px] right-1 z-20 w-[168px] rounded-[6px] bg-app-surface py-1 shadow-lg"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            <MenuItem icon={<Info size={11} />} label="Details" onClick={() => { setMenuOpen(false); onDetails(); }} />
            {manifest.updateUrl ? (
              <MenuItem
                icon={<Download size={11} />}
                label="Check for update"
                onClick={() => { setMenuOpen(false); onCheckUpdate(); }}
              />
            ) : null}
            {origin === 'user' ? (
              <MenuItem
                icon={<Trash2 size={11} />}
                label="Remove"
                danger
                onClick={() => { setMenuOpen(false); onRemove(); }}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 w-full px-2.5 py-1 text-[11px] hover:bg-app-hover ${
        danger ? 'text-accent-red' : 'text-text-secondary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
