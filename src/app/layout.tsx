import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { Header } from "@/components/Header";
import { AskShell } from "@/components/AskShell";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fix1 — Kho kiến thức sửa chữa",
  description:
    "Lưu trữ kiến thức, tình huống và tài liệu sửa chữa thiết bị kỹ thuật",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${notoSans.variable} h-full`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <Header />
        <AskShell>{children}</AskShell>
      </body>
    </html>
  );
}
