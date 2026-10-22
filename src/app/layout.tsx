import type { Metadata, Viewport } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/shell/sw-register";
import { ThemeBoot } from "@/components/shell/theme";
import { themeBootScript } from "@/lib/themes";
import "./globals.css";

// Geist for text, Archivo for headings and hero numbers, Geist Mono only for clocks, timers and times of day
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Timeo", template: "%s · Timeo" },
  description: "Choose two or three goals for a 12-week season. Timeo turns them into time blocks and focus sessions, with an assistant that plans with you.",
  applicationName: "Timeo",
  appleWebApp: { capable: true, title: "Timeo", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // theme-color is set by the boot script (src/lib/themes.ts) to follow the mode
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${archivo.variable} ${geistMono.variable} antialiased`}
      // The boot script sets data-mode (light | dark) before paint
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
