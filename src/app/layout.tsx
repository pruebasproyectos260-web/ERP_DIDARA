import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Avisos from "@/components/ui/Avisos";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Didara ERP", template: "%s · Didara ERP" },
  description: "Sistema de gestión Didara TI",
  appleWebApp: { capable: true, title: "Didara ERP", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#187d78",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body suppressHydrationWarning className={`${inter.className} h-full antialiased`} style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
        {/* Anti-flash: aplicar dark-mode antes del primer render */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('darkMode')==='true')document.body.classList.add('dark-mode')}catch(e){}})()` }} />
        {children}
        <Avisos />
      </body>
    </html>
  );
}
