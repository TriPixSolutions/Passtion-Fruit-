import "@fontsource-variable/manrope";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Passion Fruit", template: "%s · Passion Fruit" },
  description: "One calm workspace for WhatsApp conversations, campaigns and automation.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
