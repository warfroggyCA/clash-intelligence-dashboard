// web-next/src/app/layout.tsx
// GitHub integration test - $(date)
import "./globals.css";
import Script from 'next/script';
import { ThemeProvider } from '@/lib/contexts/theme-context';
import TooltipManager from '@/components/TooltipManager';
import HydrationGate from '@/components/HydrationGate';

const INITIAL_THEME_SCRIPT = `
(() => {
  try {
    const storageKey = 'clash-intelligence-theme';
    const stored = localStorage.getItem(storageKey);
    // Default to dark mode - only use light if explicitly set
    const resolved = stored === 'light' || stored === 'dark'
      ? stored
      : 'dark'; // Always default to dark mode
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

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

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const disableThemeProvider = process.env.NEXT_PUBLIC_DISABLE_THEME_PROVIDER === 'true';
  const disableHydrationGate = process.env.NEXT_PUBLIC_DISABLE_HYDRATION_GATE === 'true';
  const disableThemeInitScript = process.env.NEXT_PUBLIC_DISABLE_THEME_INIT_SCRIPT === 'true';

  const content = disableHydrationGate ? (
    children
  ) : (
    <HydrationGate>
      {children}
    </HydrationGate>
  );

  const appTree = disableThemeProvider ? (
    <>
      {process.env.NEXT_PUBLIC_DISABLE_TOOLTIP_MANAGER === 'true' ? null : <TooltipManager />}
      <div id="app-root" suppressHydrationWarning>
        {content}
      </div>
    </>
  ) : (
    <ThemeProvider defaultTheme="dark">
      {process.env.NEXT_PUBLIC_DISABLE_TOOLTIP_MANAGER === 'true' ? null : <TooltipManager />}
      <div id="app-root" suppressHydrationWarning>
        {content}
      </div>
    </ThemeProvider>
  );
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#4f46e5" />
        <meta name="msapplication-TileColor" content="#4f46e5" />
        {!disableThemeInitScript && (
          <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: INITIAL_THEME_SCRIPT }} />
        )}
      </head>
      <body suppressHydrationWarning>
        {appTree}
      </body>
    </html>
  );
}
