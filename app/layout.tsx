import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const themeInitializationScript = `
  (() => {
    const root = document.documentElement;
    let preference = "system";
    try {
      preference = JSON.parse(localStorage.getItem("routineez-preferences") || "{}").theme || "system";
    } catch {}
    const dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
  })();
`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Routine EASY — Simple Routine Tracker";
  const description = "Small routines. Easier days. A calm, colorful way to keep your day moving.";
  const favicon = "/routine-easy-splash-icon-v3.png?v=20260818-3";
  const faviconFallback = "/favicon.ico?v=20260818-3";
  return {
    title,
    description,
    icons: {
      icon: [
        { url: favicon, type: "image/png", sizes: "256x256" },
        { url: faviconFallback, type: "image/x-icon", sizes: "256x256" },
      ],
      shortcut: faviconFallback,
      apple: { url: favicon, type: "image/png", sizes: "256x256" },
    },
    openGraph: { title, description, type: "website", images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "Routine EASY routine tracker" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} /></head>
    <body>{children}</body>
  </html>;
}
