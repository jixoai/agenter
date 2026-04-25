export interface ActorSelectItem {
  value: string;
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
}

export type ActorSelectVariant = "field" | "toolbar";
export type ActorSelectDensity = "compact" | "detail";
export type ActorSelectChrome = "field" | "borderless";
