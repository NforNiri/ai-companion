import type { Metadata } from "next";
import localFont from "next/font/local";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/Theme-Provider";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FunChat.ai",
  description: "An AI companion app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn("bg-secondary",)}

        >
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>

          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>

          </SignedIn>
          {children}
          <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
