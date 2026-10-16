import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { ThemeBoot } from "@/components/shell/theme";
import { themeBootScript } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
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
