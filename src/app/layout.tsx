import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BinaryMatrix — Web3 Binary-Matrix dApp (Live Demo)",
  description:
    "Immutable 2xN binary forced matrix on Base L2 with Web2.5 onboarding, ERC-4337 account abstraction, off-chain BFS indexer and instant campaign fee splits.",
  keywords: ["BinaryMatrix", "binary matrix", "Base L2", "ERC-4337", "SBT", "affiliate", "Web3"],
  authors: [{ name: "BinaryMatrix Labs" }],
  openGraph: {
    title: "BinaryMatrix — Live MVP Demo",
    description: "On-chain 2xN binary forced matrix · gasless Web2.5 onboarding · off-chain BFS sync",
    siteName: "BinaryMatrix",
    type: "website",
    images: [
      {
        url: "/social-preview.png",
        width: 1280,
        height: 640,
        alt: "BinaryMatrix — decentralized binary-matrix protocol",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BinaryMatrix — Live MVP Demo",
    description: "On-chain 2xN binary forced matrix · gasless Web2.5 onboarding · off-chain BFS sync",
    images: ["/social-preview.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
