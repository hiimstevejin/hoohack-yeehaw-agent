import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "livekit-meet",
  description: "Boilerplate for a LiveKit meeting app"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
