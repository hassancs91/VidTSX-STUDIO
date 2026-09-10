import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** Right-aligned controls ("See all" buttons). */
  children?: ReactNode;
}

/** A section's header row — the UI_SPEC panel-header type (11 px, 500,
 *  text-muted) with the section's controls on the right. */
export function SectionRow({ title, children }: Props) {
  return (
    <div className="flex items-center justify-between h-[26px] mb-2">
      <span className="text-[11px] font-medium text-text-muted">{title}</span>
      {children && <div className="flex items-center gap-1">{children}</div>}
    </div>
  );
}
