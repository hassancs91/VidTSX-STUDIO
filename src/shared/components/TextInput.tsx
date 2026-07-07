import { forwardRef, type InputHTMLAttributes } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  size?: "sm" | "md";
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ size = "sm", className = "", ...props }, ref) {
    const sizeClasses = size === "sm" ? "h-[26px]" : "h-[32px]";

    return (
      <input
        ref={ref}
        className={`bg-app-base text-text-primary rounded-[6px] px-[8px] focus:outline-none ${sizeClasses} ${className}`}
        style={{
          fontSize: 11,
          border: "0.5px solid var(--color-border-input)",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "var(--color-accent)";
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "var(--color-border-input)";
          props.onBlur?.(e);
        }}
        {...props}
      />
    );
  }
);
