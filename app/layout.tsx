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
  title: "AI-SORTER KKN", // Perbarui judul di sini
  description: "Aplikasi Pilah Sampah berbasis AI", // Perbarui deskripsi di sini
  icons: {
    icon: '/logo_kkn.png', // Arahkan ke logo Anda di public folder
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* #region agent log */}
        <script dangerouslySetInnerHTML={{ __html: `
          fetch('http://127.0.0.1:7242/ingest/353da440-977a-4782-967e-f1775bc48330',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/layout.tsx:BODY_RENDER',message:'Body element rendered',data:{className:document.body.className, height:document.body.clientHeight, computedStyle: JSON.stringify(getComputedStyle(document.body).backgroundImage)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          fetch('http://127.0.0.1:7242/ingest/353da440-977a-4782-967e-f1775bc48330',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/layout.tsx:HTML_RENDER',message:'HTML element rendered',data:{height:document.documentElement.clientHeight, computedStyle: JSON.stringify(getComputedStyle(document.documentElement).backgroundImage)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        ` }}></script>
        {/* #endregion */}
        {children}
      </body>
    </html>
  );
}
