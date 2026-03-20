import { useEffect, useState } from "react";

export const COMPACT_VIEWPORT_QUERY = "(max-width: 1279px)";

const matchesViewport = (query: string): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
};

export const useCompactViewport = (query = COMPACT_VIEWPORT_QUERY) => {
  const [compactViewport, setCompactViewport] = useState(() => matchesViewport(query));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia(query);
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return compactViewport;
};
