"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "tint";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:opacity-90",
  secondary: "bg-sunken text-ink hover:bg-line-strong",
  ghost: "text-ink-2 hover:bg-sunken",
  danger: "bg-bad-soft text-bad",
  tint: "bg-tint text-white",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-full gap-1.5",
  md: "h-11 px-5 text-[15px] rounded-full gap-2",
  lg: "h-[52px] px-6 text-[16px] rounded-2xl gap-2 w-full",
  icon: "size-10 rounded-full",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "tap inline-flex shrink-0 items-center justify-center font-semibold tracking-tight disabled:opacity-50",
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
