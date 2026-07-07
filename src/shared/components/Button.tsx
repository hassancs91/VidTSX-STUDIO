import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: "primary" | "secondary";
  size?: "sm" | "md";
  children: ReactNode;
}

export function Button({
  variant,
  size = "sm",
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "rounded-[6px] cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = size === "sm" ? "px-[10px] py-[4px]" : "px-[14px] py-[6px]";

  const variantClasses =
    variant === "primary"
      ? "bg-accent text-white border-none hover:opacity-90"
      : "bg-transparent text-text-secondary hover:bg-app-hover";

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      style={{
        fontSize: 11,
        ...(variant === "secondary" ? { border: "0.5px solid var(--color-border-hover)" } : {}),
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
