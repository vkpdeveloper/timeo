import type { Metadata } from "next";
import { Landing } from "@/components/landing/landing";

const title = "Timeo · Put your hours where your goals are";
const description =
  "Choose two or three goals for a 12-week season. Timeo turns them into time blocks and focus sessions, with an assistant that plans with you.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://timeo.ordinity.com"),
  title: { absolute: title },
  description,
  openGraph: {
    type: "website",
    siteName: "Timeo",
    title,
    description,
    url: "/",
    images: [{ url: "/landing/og.png", width: 1200, height: 630, alt: "Timeo. Put your hours where your goals are." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/landing/og.png"] },
};

export default function WelcomePage() {
  return <Landing />;
}
