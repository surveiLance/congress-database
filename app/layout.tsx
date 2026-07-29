import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First District Assistance Management System",
  description: "Antipolo City First District assistance applicant and beneficiary management system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
