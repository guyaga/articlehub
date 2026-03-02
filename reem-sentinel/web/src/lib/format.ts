export function timeAgo(date: string | null): string {
  if (!date) return "\u2014";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatDate(date: string | null, locale: string = "he"): string {
  if (!date) return "\u2014";
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function relevanceColor(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 0.7) return "bg-red-500/15 text-red-400";
  if (score >= 0.4) return "bg-amber-500/15 text-amber-400";
  return "bg-green-500/15 text-green-400";
}

export function sentimentColor(sentiment: string | null): string {
  switch (sentiment) {
    case "supportive":
      return "bg-green-500/15 text-green-400";
    case "opposing":
      return "bg-red-500/15 text-red-400";
    case "mixed":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-blue-500/15 text-blue-400";
  }
}

export function scanStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-500/15 text-green-400";
    case "running":
      return "bg-blue-500/15 text-blue-400";
    case "failed":
      return "bg-red-500/15 text-red-400";
    case "partial":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}
