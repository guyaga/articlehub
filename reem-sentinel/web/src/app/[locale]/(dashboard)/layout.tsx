"use client";

import type { ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

const navItems = [
  { key: "dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "scans", href: "/scans", icon: "Radar" },
  { key: "articles", href: "/articles", icon: "Newspaper" },
  { key: "content", href: "/content", icon: "FileText" },
  { key: "knowledge", href: "/knowledge", icon: "BookOpen" },
  { key: "settings", href: "/settings", icon: "Settings" },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "he" ? "en" : "he";
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <Sidebar side={locale === "he" ? "right" : "left"} className="glass-subtle">
        <SidebarHeader className="p-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {tCommon("appName")}
          </h1>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                >
                  <Link href={item.href}>{t(item.key)}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <Separator className="my-2" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href={pathname} locale={otherLocale}>
                  {otherLocale === "he" ? "עברית" : "English"}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4" />
                <span className="text-xs">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span className="text-xs">Dark Mode</span>
              </>
            )}
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="gradient-mesh">
        <header className="flex h-14 items-center gap-2 border-b border-white/5 backdrop-blur-sm px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
