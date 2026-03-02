import type { ReactNode } from "react";

// Root layout — next-intl middleware handles redirecting to /he or /en
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
