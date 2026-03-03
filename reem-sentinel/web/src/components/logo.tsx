import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      {/* Document / article shape */}
      <rect x="6" y="4" width="20" height="24" rx="3" fill="url(#logo-grad)" opacity="0.15" />
      <rect x="6" y="4" width="20" height="24" rx="3" stroke="url(#logo-grad)" strokeWidth="1.5" fill="none" />
      {/* Text lines */}
      <line x1="10" y1="11" x2="22" y2="11" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="15" x2="19" y2="15" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="19" x2="22" y2="19" stroke="url(#logo-grad)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Hub node dots */}
      <circle cx="26" cy="8" r="2.5" fill="url(#logo-grad)" />
      <circle cx="26" cy="16" r="2" fill="url(#logo-grad)" opacity="0.7" />
      <circle cx="26" cy="24" r="2.5" fill="url(#logo-grad)" />
      {/* Connection lines */}
      <line x1="22" y1="11" x2="24" y2="8.5" stroke="url(#logo-grad)" strokeWidth="0.8" opacity="0.5" />
      <line x1="22" y1="19" x2="24" y2="23.5" stroke="url(#logo-grad)" strokeWidth="0.8" opacity="0.5" />
    </svg>
  );
}
