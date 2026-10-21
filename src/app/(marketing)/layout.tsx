/** Public marketing pages: no app shell, no tab bar. Always Sky, whatever accent the device picked (globals.css). */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div data-accent-lock="" className="contents">
      {children}
    </div>
  );
}
