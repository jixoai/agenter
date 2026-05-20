export type WorkbenchPageTabBadgeTone = "neutral" | "accent" | "positive" | "warning" | "critical";

export interface WorkbenchPageTabItem {
  value: string;
  label: string;
  title?: string;
  badgeLabel?: string;
  badgeTone?: WorkbenchPageTabBadgeTone;
  badgeAnimated?: boolean;
}
