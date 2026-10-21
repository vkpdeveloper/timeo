import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

const title = "Timeo · Always know what to do next";
const description =
  "Twelve-week seasons, time blocks, focus, training and an assistant that runs in the background. Every day opens with a plain answer: what matters now, how much time is left, what to do next.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://timeo.ordinity.com"),
  title: { absolute: title },
  description,
  openGraph: {
    type: "website",
    siteName: "Timeo",
    title,
    description,
    images: [{ url: "/landing/desktop.png", width: 2880, height: 1800, alt: "Timeo on desktop" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/landing/desktop.png"] },
};

export default function WelcomePage() {
  return <Landing />;
}
