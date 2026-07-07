export function ComingSoonPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="text-[14px] font-medium text-text-secondary mb-1">
        {label} Models
      </div>
      <div className="text-[12px] text-text-dim">
        Coming soon
      </div>
    </div>
  );
}
