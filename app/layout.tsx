import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShrotiHost Licensing",
  description: "Licence activation and updates for ShrotiHost WHMCS modules.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
