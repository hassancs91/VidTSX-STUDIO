interface ProgressBarProps {
  value: number;
  color?: "purple" | "green" | "amber" | "red";
}

const colorMap = {
  purple: "var(--color-accent)",
  green: "var(--color-accent-green)",
  amber: "var(--color-accent-amber)",
  red: "var(--color-accent-red)",
};

export function ProgressBar({ value, color = "purple" }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-[4px] bg-app-hover rounded-[2px] overflow-hidden">
      <div
        className="h-full rounded-[2px] transition-[width] duration-200"
        style={{
          width: `${clampedValue}%`,
          backgroundColor: colorMap[color],
        }}
      />
    </div>
  );
}
