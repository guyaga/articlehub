import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { routing } from "@/i18n/routing";
import { inter, heebo } from "@/lib/fonts";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

export const metadata: Metadata = {
  title: "ArticleHub",
  description: "AI-powered news monitoring and intelligence platform",
  openGraph: {
    title: "ArticleHub",
    description: "AI-powered news monitoring and intelligence platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArticleHub",
    description: "AI-powered news monitoring and intelligence platform",
  },
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "he" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === "he" ? "rtl" : "ltr";
  const fontClass = locale === "he" ? heebo.variable : inter.variable;

  return (
    <html lang={locale} dir={dir} className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className={`${fontClass} ${inter.variable} antialiased font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              {children}
              <Toaster position={locale === "he" ? "bottom-left" : "bottom-right"} />
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
