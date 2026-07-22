import type { ShareRow } from "./db.js";
import { config } from "./config.js";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ]!,
  );
}

export function landingPage(row: ShareRow, token: string): string {
  const name = escapeHtml(row.project_name);
  const deepLink = `caide://receive-project?token=${encodeURIComponent(token)}`;
  const size = (Number(row.package_size) / 1024 / 1024).toFixed(1);
  const unavailable =
    row.status !== "active" ||
    row.expires_at.getTime() <= Date.now() ||
    (row.max_downloads !== null && row.download_count >= row.max_downloads);
  const title = unavailable
    ? "CAIDE share unavailable"
    : `${name} — CAIDE project`;
  const windowsUrl = escapeHtml(config.CAIDE_DOWNLOAD_WINDOWS);
  const linuxUrl = escapeHtml(config.CAIDE_DOWNLOAD_LINUX);
  const macosUrl = escapeHtml(config.CAIDE_DOWNLOAD_MACOS);

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="Open a shared CAIDE project snapshot."><meta property="og:type" content="website"><meta property="og:title" content="${title}"><meta property="og:description" content="Open this project snapshot in CAIDE."><style>html{color-scheme:dark light;font-family:Inter,system-ui,sans-serif}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0f;color:#f4f4f2}.card{width:min(520px,calc(100vw - 32px));box-sizing:border-box;padding:28px;border:1px solid #303239;border-radius:12px;background:#121317;box-shadow:0 24px 80px #0008}.mark{font-weight:800;letter-spacing:.15em}h1{font-size:28px;margin:28px 0 8px}p,.meta{color:#999da6;line-height:1.55}.meta{padding:12px 0;border-top:1px solid #2b2d33;border-bottom:1px solid #2b2d33}.actions{display:grid;gap:10px;margin-top:22px}a{display:flex;justify-content:center;padding:12px;border-radius:7px;text-decoration:none;font-weight:700;background:#f4f4f2;color:#111216}.secondary{background:transparent;color:#d8d9db;border:1px solid #3a3e45}.downloads{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.downloads a{font-size:12px}@media(prefers-color-scheme:light){body{background:#eef0f2;color:#17191d}.card{background:#fff;border-color:#d8dade;box-shadow:0 24px 70px #0002}.meta{border-color:#d8dade}.secondary{color:#34383f;border-color:#cfd2d7}}</style></head><body><main class="card"><div class="mark">CAIDE</div><h1>${unavailable ? "This project link is unavailable" : name}</h1><p>${unavailable ? "The link expired, was revoked, or reached its download limit." : "A CAIDE project snapshot was shared with you. Review it in the desktop app before downloading or running any code."}</p>${unavailable ? "" : `<div class="meta">${size} MB · expires ${row.expires_at.toLocaleDateString()}</div><div class="actions"><a href="${deepLink}">Open in CAIDE</a><a class="secondary" href="${deepLink}">Try opening the desktop app again</a></div><div class="downloads"><a class="secondary" href="${windowsUrl}">Windows</a><a class="secondary" href="${linuxUrl}">Linux</a><a class="secondary" href="${macosUrl}">macOS</a></div>`}</main></body></html>`;
}
