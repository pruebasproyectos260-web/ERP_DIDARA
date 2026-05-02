import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Didara ERP",
  description: "Sistema de gestión Didara TI",
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
        <script dangerouslySetInnerHTML={{ __html: `(function(){if(localStorage.getItem('darkMode')==='true')document.body.classList.add('dark-mode')})()` }} />
        {children}
      </body>
    </html>
  );
}
