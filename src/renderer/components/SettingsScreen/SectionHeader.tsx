export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-medium text-text-primary mt-6 mb-3 first:mt-0">
      {children}
    </h3>
  );
}
