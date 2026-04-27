import { createHash } from "node:crypto";

const gravatarHash = (email: string): string => createHash("md5").update(email.trim().toLowerCase()).digest("hex");

export const buildGravatarUrl = (email: string, size = 96): string =>
  `https://www.gravatar.com/avatar/${gravatarHash(email)}?d=404&s=${size}`;

export const fetchGravatar = async (email: string, size = 96): Promise<{ mimeType: string; bytes: Uint8Array } | null> => {
  try {
    const response = await fetch(buildGravatarUrl(email, size), { redirect: "follow" });
    if (!response.ok) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      mimeType: response.headers.get("content-type") ?? "image/jpeg",
      bytes,
    };
  } catch {
    return null;
  }
};
