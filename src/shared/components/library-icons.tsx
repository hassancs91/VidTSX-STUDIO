export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
    >
      <path d="M3.5 2L6.5 5L3.5 8" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4H12" />
      <path d="M5 4V2.5C5 2.22 5.22 2 5.5 2H8.5C8.78 2 9 2.22 9 2.5V4" />
      <path d="M3 4L3.5 12C3.5 12.28 3.72 12.5 4 12.5H10C10.28 12.5 10.5 12.28 10.5 12L11 4" />
    </svg>
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M2 3.5C2 3.22 2.22 3 2.5 3H5.5L7 4.5H11.5C11.78 4.5 12 4.72 12 5V5.5" />
          <path d="M2.5 12H10.5C10.78 12 11.03 11.82 11.1 11.55L12.6 6.55C12.7 6.2 12.44 5.85 12.07 5.85H3.5C3.22 5.85 2.97 6.03 2.9 6.3L1.5 11.5V4C1.5 3.72 1.72 3.5 2 3.5" />
        </>
      ) : (
        <>
          <path d="M2 3.5C2 3.22 2.22 3 2.5 3H5.5L7 4.5H11.5C11.78 4.5 12 4.72 12 5V11C12 11.28 11.78 11.5 11.5 11.5H2.5C2.22 11.5 2 11.28 2 11V3.5Z" />
        </>
      )}
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round">
      <path d="M6 2.5V9.5" />
      <path d="M2.5 6H9.5" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 2V9" />
      <path d="M4 6.5L7 9.5L10 6.5" />
      <path d="M2.5 11.5H11.5" />
    </svg>
  );
}

export function ProjectIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="10" height="9" rx="1" />
      <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="currentColor" />
    </svg>
  );
}

export function TsxIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5H3.5C3.22 1.5 3 1.72 3 2V12C3 12.28 3.22 12.5 3.5 12.5H10.5C10.78 12.5 11 12.28 11 12V4.5L8 1.5Z" />
      <path d="M8 1.5V4.5H11" />
      <path d="M5.5 8L7 9.5L8.5 8" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <circle cx="5" cy="5.5" r="1.2" />
      <path d="M1.5 10L4.5 7L7 9.5L9 7.5L12.5 10" />
    </svg>
  );
}

export function FilePlusIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5H3.5C3.22 1.5 3 1.72 3 2V12C3 12.28 3.22 12.5 3.5 12.5H10.5C10.78 12.5 11 12.28 11 12V4.5L8 1.5Z" />
      <path d="M8 1.5V4.5H11" />
      <path d="M7 7.5V10.5" />
      <path d="M5.5 9H8.5" />
    </svg>
  );
}

export function VideoIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="9" height="8" rx="1" />
      <path d="M10.5 6L12.5 4.5V9.5L10.5 8V6Z" fill="currentColor" />
    </svg>
  );
}

export function AudioIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4V10C5.5 10.83 4.83 11.5 4 11.5C3.17 11.5 2.5 10.83 2.5 10C2.5 9.17 3.17 8.5 4 8.5C4.55 8.5 5.05 8.78 5.32 9.22" />
      <path d="M5.5 4L11 2.5V8.5C11 9.33 10.33 10 9.5 10C8.67 10 8 9.33 8 8.5C8 7.67 8.67 7 9.5 7C10.05 7 10.55 7.28 10.82 7.72" />
    </svg>
  );
}

export function FontIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11L6 3H8L11 11" />
      <path d="M4 8.5H10" />
    </svg>
  );
}

export function CubeIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5L12 4V10L7 12.5L2 10V4L7 1.5Z" />
      <path d="M2 4L7 6.5L12 4" />
      <path d="M7 6.5V12.5" />
    </svg>
  );
}

export function DocumentIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5H3.5C3.22 1.5 3 1.72 3 2V12C3 12.28 3.22 12.5 3.5 12.5H10.5C10.78 12.5 11 12.28 11 12V4.5L8 1.5Z" />
      <path d="M8 1.5V4.5H11" />
      <path d="M5 7H9" />
      <path d="M5 9H9" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="4.5" width="7" height="8" rx="1" />
      <path d="M2.5 9.5V2.5C2.5 2.22 2.72 2 3 2H9C9.28 2 9.5 2.22 9.5 2.5V4.5" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 14 14" fill="none" stroke="currentColor"
      strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2L12 4.5L4.5 12L2 12.5L2.5 10L9.5 2Z" />
      <path d="M8.5 3L11 5.5" />
    </svg>
  );
}
