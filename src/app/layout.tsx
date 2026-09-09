import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { RunStatusProvider } from "@/lib/runStatus/RunStatusContext";
import { RunStatusBar } from "@/components/RunStatusBar";
import { HeaderNav } from "@/components/HeaderNav";
import "./globals.css";

// "Archivo everywhere" per the design system — body text at 400, headings at
// 800, one family throughout rather than pairing it with a second typeface.
const archivo = Archivo({
  variable: "--font-archivo",
  weight: ["400", "600", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reverse Search",
  description: "Company fit analyzer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RunStatusProvider>
          <HeaderNav />
          <RunStatusBar />
          <main className="flex-1 flex flex-col items-center">{children}</main>
        </RunStatusProvider>
      </body>
    </html>
  );
}
