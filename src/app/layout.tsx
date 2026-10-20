import type { Metadata, Viewport } from "next";
import { Mona_Sans, Newsreader } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { ThemeBoot } from "@/components/shell/theme";
import { themeBootScript } from "@/lib/themes";
import "./globals.css";

// Two typefaces: Mona Sans for the interface, Newsreader for big titles and hero numbers
const monaSans = Mona_Sans({ variable: "--font-mona-sans", subsets: ["latin"], axes: ["wdth"] });
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Timeo", template: "%s · Timeo" },
  description: "Point your hours at what matters. Seasons, goals, time blocks, focus, training and nutrition in one calm place.",
  applicationName: "Timeo",
  appleWebApp: { capable: true, title: "Timeo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // theme-color is set by the theme boot script (src/lib/themes.ts) to follow the chosen theme
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${monaSans.variable} ${newsreader.variable} antialiased`}
      // The boot script sets data-theme / data-mode (and custom theme variables) before paint
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body>
        <ThemeBoot />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
