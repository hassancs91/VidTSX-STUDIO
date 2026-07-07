import type { ReactNode } from "react";

interface BadgeProps {
  variant: "free" | "pro" | "active" | "expired" | "inactive";
  children: ReactNode;
}

const VARIANT_CLASSES: Record<BadgeProps["variant"], string> = {
  free: "bg-[#085041] text-accent-green",
  pro: "bg-[#3C3489] text-[#AFA9EC]",
  active: "bg-[#085041] text-accent-green",
  expired: "bg-[#3C1A1A] text-accent-red",
  inactive: "bg-[#3A2A0A] text-accent-amber",
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`text-[9px] px-[5px] py-[1px] rounded-[4px] ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}
