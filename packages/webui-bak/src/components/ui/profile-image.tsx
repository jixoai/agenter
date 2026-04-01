import { useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { ClipSurface } from "./overflow-surface";

const hashLabel = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
};

const fallbackLabel = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "?";
  }
  const digits = trimmed.replaceAll(/[^0-9]/g, "");
  if (digits.length > 0) {
    return digits.slice(-2);
  }
  return trimmed.slice(0, 1).toUpperCase();
};

interface ProfileImageProps {
  src?: string | null;
  label: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
}

export const ProfileImage = ({ src, label, alt, className, imageClassName }: ProfileImageProps) => {
  const [failed, setFailed] = useState(false);
  const hue = useMemo(() => hashLabel(label), [label]);
  const fallback = fallbackLabel(label);

  if (src && !failed) {
    return (
      <ClipSurface className={cn("inline-flex rounded-full bg-slate-100", className)}>
        <img
          src={src}
          alt={alt ?? label}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setFailed(true)}
        />
      </ClipSurface>
    );
  }

  return (
    <span
      aria-hidden={alt ? undefined : true}
      className={cn("inline-flex items-center justify-center rounded-full font-semibold", className)}
      style={{
        backgroundColor: `oklch(0.84 0.09 ${hue})`,
        color: `oklch(0.34 0.08 ${hue})`,
      }}
      title={alt ?? label}
    >
      {fallback}
    </span>
  );
};
