import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type WebAuthnUiPage = "register" | "authenticate";
export type WebAuthnUiAssetKind = "js" | "css";

const defaultWebAuthnUiDir = fileURLToPath(new URL("./webauthn-ui", import.meta.url).href);

const assetFileName = (page: WebAuthnUiPage, kind: WebAuthnUiAssetKind): string =>
  kind === "js" ? `${page}.js` : `${page}.css`;

const readTextAsset = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);

export const resolveWebAuthnUiAsset = (
  page: WebAuthnUiPage,
  kind: WebAuthnUiAssetKind,
  uiDir?: string,
): { content: string; contentType: string } | null => {
  const assetPath = `${uiDir ?? defaultWebAuthnUiDir}/${assetFileName(page, kind)}`;
  const content = readTextAsset(assetPath);
  if (content === null) {
    return null;
  }
  return {
    content,
    contentType: kind === "js" ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8",
  };
};

export const renderWebAuthnUiPage = (page: WebAuthnUiPage): string => {
  const title = page === "register" ? "Register passkey" : "Authenticate passkey";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/auth/webauthn/assets/${page}.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/auth/webauthn/assets/${page}.js"></script>
  </body>
</html>`;
};
