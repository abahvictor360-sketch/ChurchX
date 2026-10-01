import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ChurchX", template: "%s · ChurchX" },
  description: "Church management for members, visitors, follow-up, attendance, giving and member care.",
  applicationName: "ChurchX",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1218" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Applies the saved theme before paint to avoid a flash (theme preference only — no sensitive data).
const themeScript = `try{if(localStorage.getItem('cx-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
