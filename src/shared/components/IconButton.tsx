import type { ReactNode, ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label?: string;
  active?: boolean;
}

export function IconButton({ icon, label, active, className = "", ...props }: IconButtonProps) {
  const stateClasses = active
    ? "bg-app-active text-accent-light"
    : "text-text-muted hover:bg-app-hover";

  return (
    <button
      className={`flex items-center justify-center w-[28px] h-[28px] rounded-[6px] transition-colors duration-150 ${stateClasses} ${className}`}
      title={label}
      {...props}
    >
      {icon}
    </button>
  );
}
