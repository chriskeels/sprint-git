import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StackUp — Your Money, Leveled Up",
  description: "The teen-friendly budgeting app for Philly students",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
