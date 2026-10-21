"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "tint";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  /** Strong neutral (ink fill). */
  primary: "bg-ink text-bg hover:opacity-90 active:opacity-85",
  /** The one primary action on a screen (accent fill). */
  accent: "bg-accent text-accent-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)] hover:brightness-105 active:brightness-95",
  secondary: "bg-sunken text-ink hover:bg-line-strong active:bg-line-strong",
  outline: "border border-line bg-surface text-ink shadow-soft hover:bg-surface-2 active:bg-sunken",
  ghost: "text-ink-2 hover:bg-sunken active:bg-sunken",
  danger: "bg-bad-soft text-bad active:opacity-85",
  /** Accent fill that follows a local --tint (goal / routine colour). */
  tint: "bg-tint text-tint-ink active:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-full gap-1.5",
  md: "h-11 px-5 text-[15px] rounded-full gap-2",
  lg: "h-12 px-6 text-[16px] rounded-2xl gap-2 w-full",
  icon: "size-11 rounded-full",
  "icon-sm": "size-9 rounded-full",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "tap inline-flex shrink-0 items-center justify-center font-semibold tracking-tight whitespace-nowrap select-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </button>
  );
});

/** Submit button that shows a spinner while its parent form's action runs. */
export function SubmitButton({ children, ...props }: Omit<ButtonProps, "type" | "loading">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
