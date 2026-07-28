import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First District Assistance Program System",
  description: "Antipolo City First District assistance program applicant and beneficiary database",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
