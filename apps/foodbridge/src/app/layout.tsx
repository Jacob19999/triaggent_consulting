import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { DataProvider } from "@/components/DataProvider";
import { QrHandoff } from "@/components/QrHandoff";
import { THEME_SCRIPT } from "@/lib/themeScript";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FoodBridge", template: "%s · FoodBridge" },
  description:
    "Food access equity overview, manager workspace and food shelf portal for Minnesota's food-shelf network. County and tract aggregates only.",
  robots: process.env.FOODBRIDGE_ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23143f35'/%3E%3Cpath d='M14 41Q32 10 50 41M14 46h36M24 29v17m16-17v17' fill='none' stroke='%23d9e7a9' stroke-width='5'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1219" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <DataProvider>{children}</DataProvider>
        <QrHandoff />
      </body>
    </html>
  );
}
