// web-next/src/app/layout.tsx
// GitHub integration test - $(date)
import "./globals.css";

export const metadata = {
  title: "Clash Intelligence Dashboard",
  description: "Advanced clan analytics and management for Clash of Clans. Track member activity, war performance, donations, and strategic insights.",
  keywords: "Clash of Clans, clan management, analytics, dashboard, war tracking, member activity",
  authors: [{ name: "Clash Intelligence" }],
  robots: "index, follow",
  openGraph: {
    title: "Clash Intelligence Dashboard",
    description: "Advanced clan analytics and management for Clash of Clans",
    type: "website",
    locale: "en_US",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" }
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ],
    other: [
      { rel: "manifest", url: "/site.webmanifest" }
    ]
  }
};

export function generateViewport() {
  return {
    width: "device-width",
    initialScale: 1,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="msapplication-TileColor" content="#4f46e5" />
      </head>
      <body>{children}</body>
    </html>
  );
}

// Force deployment Thu Sep 11 20:14:37 EDT 2025
// Force cache bust Thu Sep 11 20:21:50 EDT 2025
// Force fresh deployment Thu Sep 11 20:34:41 EDT 2025
// Trigger deployment Fri Sep 12 08:22:17 EDT 2025
