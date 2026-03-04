"use client";

import type { ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import { useTheme } from "next-themes";
import {
  Moon,
  Sun,
  LayoutDashboard,
  Radar,
  Newspaper,
  Star,
  FileText,
  BookOpen,
  ClipboardList,
  Settings,
} from "lucide-react";
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
  SidebarGroup,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  key: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    labelKey: "groupMonitor",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "scans", href: "/scans", icon: Radar },
    ],
  },
  {
    labelKey: "groupContent",
    items: [
      { key: "feed", href: "/articles", icon: Newspaper },
      { key: "relevant", href: "/relevant", icon: Star },
      { key: "content", href: "/content", icon: FileText },
    ],
  },
  {
    labelKey: "groupKnowledge",
    items: [
      { key: "knowledge", href: "/knowledge", icon: BookOpen },
    ],
  },
  {
    labelKey: "groupSystem",
    items: [
      { key: "status", href: "/status", icon: ClipboardList },
      { key: "settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tTheme = useTranslations("theme");
  const locale = useLocale();
  const pathname = usePathname();
  const otherLocale = locale === "he" ? "en" : "he";
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <Sidebar side={locale === "he" ? "right" : "left"} className="glass-subtle">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              {tCommon("appName")}
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {navGroups.map((group) => (
            <SidebarGroup key={group.labelKey}>
              <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/60 px-3">
                {t(group.labelKey)}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.href)}
                      >
                        <Link href={item.href} className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{t(item.key)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
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
                <span className="text-xs">{tTheme("light")}</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span className="text-xs">{tTheme("dark")}</span>
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
