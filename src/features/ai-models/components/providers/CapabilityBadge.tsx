const BADGE_STYLES: Record<string, string> = {
  Images: 'bg-[#3C3489] text-[#AFA9EC]',
  Video: 'bg-[#1E40AF] text-[#93C5FD]',
  LLMs: 'bg-[#1A7F64] text-[#6EE7B7]',
  Transcription: 'bg-[#7C4A03] text-[#FCD34D]',
};

/**
 * Tiny colored tag showing what a provider's key unlocks (Images / Video /
 * LLMs / Transcription) — capability is expressed per row, not by splitting
 * the page into per-category sections.
 */
export function CapabilityBadge({ label }: { label: string }) {
  return (
    <span className={`text-[9px] px-[5px] py-[1px] rounded-[4px] shrink-0 ${BADGE_STYLES[label] ?? 'bg-app-hover text-text-dim'}`}>
      {label}
    </span>
  );
}
