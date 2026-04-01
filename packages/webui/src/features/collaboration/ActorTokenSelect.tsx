import { Copy, KeyRound } from "lucide-react";
import { useMemo } from "react";

import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";

export interface ActorTokenOption {
  accessToken: string;
  label: string;
  subtitle?: string;
  roleLabel?: string;
}

interface ActorTokenSelectProps {
  label: string;
  emptyLabel: string;
  value: string | null;
  options: ActorTokenOption[];
  onChange: (accessToken: string) => void;
}

export const ActorTokenSelect = ({ label, emptyLabel, value, options, onChange }: ActorTokenSelectProps) => {
  const selected = useMemo(
    () => options.find((option) => option.accessToken === value) ?? options[0] ?? null,
    [options, value],
  );

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.16em] text-slate-500 uppercase">
          <KeyRound className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        {selected?.accessToken && typeof navigator !== "undefined" && navigator.clipboard?.writeText ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(selected.accessToken);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy token
          </Button>
        ) : null}
      </div>

      <Select
        aria-label={label}
        value={selected?.accessToken ?? ""}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={options.length === 0}
      >
        {options.length === 0 ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.accessToken} value={option.accessToken}>
            {[option.label, option.roleLabel, option.subtitle].filter(Boolean).join(" · ")}
          </option>
        ))}
      </Select>
    </div>
  );
};
