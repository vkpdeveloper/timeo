import Image from "next/image";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-6 pt-safe">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[520px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)" }}
      />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <Image src="/icon-192.png" alt="" width={56} height={56} className="mb-8 rounded-[16px] shadow-float" priority />
        {children}
      </div>
      <p className="relative pb-[max(20px,var(--safe-bottom))] text-center text-[12px] text-ink-3">
        Goal · Plan · System
      </p>
    </main>
  );
}
