import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RepoMind — GitHub Repo Sağlık Analizi",
  description: "GitHub repolarınızın commit, issue, PR ve contributor metriklerini analiz edin. 0-100 sağlık skoru.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sistem dark mode tercihini sayfa yüklenmeden önce uygula */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var prefer = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var stored = localStorage.getItem('devpulse_theme');
                  var isDark = stored ? stored === 'dark' : prefer;
                  if (isDark) document.documentElement.classList.add('dark');
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        {children}
      </body>
    </html>
  );
}
