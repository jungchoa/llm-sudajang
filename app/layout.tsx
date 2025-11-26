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
  title: "LLM-Sudajang | AI 수다 배틀",
  description: "세 명의 AI가 당신이 던진 주제로 수다를 떱니다. 낙관론자 유토, 비관론자 디스토, 밈러 도파의 티키타카! Inspired by Andrej Karpathy's LLM Council.",
  keywords: ["AI", "LLM", "ChatGPT", "Claude", "Gemini", "토론", "수다", "AI 대화"],
  authors: [{ name: "CHOA" }],
  creator: "CHOA",
  openGraph: {
    title: "LLM-Sudajang | AI 수다 배틀",
    description: "세 명의 AI가 당신이 던진 주제로 수다를 떱니다. 낙관론자, 비관론자, 밈 중독자의 티키타카!",
    url: "https://llm-sudajang.vercel.app",
    siteName: "LLM-Sudajang",
    images: [
      {
        url: "/assets/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "LLM-Sudajang - AI 수다 배틀",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM-Sudajang | AI 수다 배틀",
    description: "세 명의 AI가 당신이 던진 주제로 수다를 떱니다!",
    images: ["/assets/images/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#0A0A0A" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
