import type { ShareRow } from "./db.js";
import { config } from "./config.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
      char
    ]!,
  );
}

const BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none"><rect width="256" height="256" rx="64" fill="#000"/><path d="M196 62A96 96 0 1 0 196 194" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><circle cx="128" cy="128" r="22" fill="#fff"/></svg>`;
const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(BRAND_SVG)}`;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type ShareState = "active" | "expired" | "revoked" | "download-limit";

function resolveShareState(row: ShareRow): ShareState {
  if (row.status === "revoked") return "revoked";
  if (row.expires_at.getTime() <= Date.now()) return "expired";
  if (row.max_downloads !== null && row.download_count >= row.max_downloads) {
    return "download-limit";
  }
  return "active";
}

function pageShell({
  title,
  description,
  body,
  canonicalUrl = config.SHARE_PUBLIC_BASE_URL,
}: {
  title: string;
  description: string;
  body: string;
  canonicalUrl?: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeCanonicalUrl = escapeHtml(canonicalUrl);
  const socialImageUrl = escapeHtml(
    `${config.SHARE_PUBLIC_BASE_URL}/assets/caide-share-card.svg`,
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}">
    <meta name="theme-color" content="#030507">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="CAIDE">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    <meta property="og:url" content="${safeCanonicalUrl}">
    <meta property="og:image" content="${socialImageUrl}">
    <meta property="og:image:type" content="image/svg+xml">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${safeTitle}">
    <meta name="twitter:description" content="${safeDescription}">
    <meta name="twitter:image" content="${socialImageUrl}">
    <link rel="canonical" href="${safeCanonicalUrl}">
    <link rel="icon" href="${FAVICON_DATA_URI}">
    <style>
      :root {
        color-scheme: dark;
        --bg: #030507;
        --panel: rgba(13, 17, 23, 0.84);
        --panel-border: rgba(255,255,255,0.08);
        --panel-soft: rgba(255,255,255,0.04);
        --text: #f5f7fa;
        --muted: #9ca5b3;
        --line: rgba(255,255,255,0.09);
        --primary: #ffffff;
        --primary-text: #08090c;
        --secondary: rgba(255,255,255,0.06);
        --secondary-hover: rgba(255,255,255,0.1);
        --warning: rgba(255, 208, 120, 0.1);
        --warning-border: rgba(255, 208, 120, 0.2);
        --shadow: 0 24px 80px rgba(0,0,0,0.45);
      }

      * { box-sizing: border-box; }
      html { -webkit-text-size-adjust: 100%; }
      html, body { min-height: 100%; }
      button, a { -webkit-tap-highlight-color: transparent; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.1), transparent 32%),
          radial-gradient(circle at bottom left, rgba(255,255,255,0.06), transparent 30%),
          var(--bg);
        color: var(--text);
        overflow-x: hidden;
      }

      body::before,
      body::after {
        content: "";
        position: fixed;
        inset: auto;
        width: 42rem;
        height: 42rem;
        border-radius: 999px;
        filter: blur(80px);
        opacity: 0.12;
        pointer-events: none;
        animation: drift 12s ease-in-out infinite;
      }
      body::before { top: -12rem; right: -10rem; background: #ffffff; }
      body::after { left: -14rem; bottom: -14rem; background: #7d8590; animation-delay: -5s; }

      @keyframes drift {
        0%, 100% { transform: translate3d(0,0,0) scale(1); }
        50% { transform: translate3d(0.5rem, 1rem, 0) scale(1.05); }
      }

      .shell {
        width: min(1120px, calc(100vw - 32px));
        margin: 0 auto;
        min-height: 100vh;
        min-height: 100dvh;
        display: grid;
        align-items: center;
        padding: max(40px, env(safe-area-inset-top)) max(0px, env(safe-area-inset-right)) max(40px, env(safe-area-inset-bottom)) max(0px, env(safe-area-inset-left));
      }

      .card {
        position: relative;
        overflow: hidden;
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(280px, 360px);
        border: 1px solid var(--panel-border);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)), var(--panel);
        backdrop-filter: blur(24px);
        box-shadow: var(--shadow);
      }

      .card::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.04), transparent 36%, transparent 60%, rgba(255,255,255,0.03));
        pointer-events: none;
      }

      .primary, .side {
        position: relative;
        z-index: 1;
        padding: 32px;
      }

      .side {
        border-left: 1px solid var(--line);
        background: rgba(255,255,255,0.02);
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 26px;
      }

      .brand-badge {
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
      }

      .brand-badge svg { width: 28px; height: 28px; display: block; }
      .brand-text { display: grid; gap: 4px; }
      .eyebrow {
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .brand-name {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      h1 {
        margin: 0 0 14px;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }
      .lede {
        margin: 0;
        font-size: 16px;
        line-height: 1.7;
        color: var(--muted);
        max-width: 58ch;
      }
      .meta-grid {
        margin-top: 28px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }
      .meta-item {
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: var(--panel-soft);
      }
      .meta-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
        margin-bottom: 8px;
      }
      .meta-value {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .warning {
        margin-top: 24px;
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid var(--warning-border);
        background: var(--warning);
        color: #f4dfb7;
        line-height: 1.65;
      }
      .warning strong { color: #fff3d7; }
      .actions {
        margin-top: 28px;
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .button {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        appearance: none;
        cursor: pointer;
        font: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 52px;
        padding: 0 18px;
        border-radius: 16px;
        border: 1px solid transparent;
        text-decoration: none;
        font-weight: 700;
        letter-spacing: -0.01em;
        touch-action: manipulation;
        transition: transform 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
      }
      .button::before {
        content: "";
        position: absolute;
        z-index: -1;
        inset: -1px;
        background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.34) 48%, transparent 72%);
        transform: translateX(-140%);
        transition: transform 520ms cubic-bezier(.2,.8,.2,1);
      }
      .button:hover { transform: translateY(-2px); }
      .button:hover::before { transform: translateX(140%); }
      .button:active { transform: translateY(0) scale(0.985); }
      .button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
      .button.primary { background: var(--primary); color: var(--primary-text); box-shadow: 0 12px 28px rgba(255,255,255,0.12); }
      .button.primary:hover { box-shadow: 0 16px 34px rgba(255,255,255,0.17); }
      .button.secondary {
        background: var(--secondary);
        color: var(--text);
        border-color: rgba(255,255,255,0.1);
      }
      .button.secondary:hover { background: var(--secondary-hover); }
      .copy-button[data-copied="true"] {
        border-color: rgba(126,240,163,0.32);
        background: rgba(126,240,163,0.1);
        color: #c7f8d5;
      }
      .side-title {
        margin: 0 0 14px;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .side-copy {
        margin: 0 0 20px;
        color: var(--muted);
        line-height: 1.7;
        font-size: 14px;
      }
      .download-list {
        display: grid;
        gap: 10px;
      }
      .download-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        color: var(--text);
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        transition: background 180ms ease, transform 180ms ease, border-color 180ms ease;
      }
      .download-item:hover {
        transform: translateY(-1px);
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.12);
      }
      .download-name { font-weight: 700; }
      .download-caption { font-size: 12px; color: var(--muted); margin-top: 4px; }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }
      .bullet {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #7ef0a3;
        box-shadow: 0 0 16px rgba(126,240,163,0.5);
      }
      .footer-note {
        margin-top: 18px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.7;
      }
      .status-card {
        max-width: 680px;
        margin: 0 auto;
      }

      @media (max-width: 900px) {
        .card { grid-template-columns: 1fr; }
        .side { border-left: 0; border-top: 1px solid var(--line); }
        .meta-grid { grid-template-columns: 1fr; }
      }

      @media (max-width: 640px) {
        .shell {
          width: min(100vw, calc(100vw - 16px));
          padding-top: max(12px, env(safe-area-inset-top));
          padding-bottom: max(12px, env(safe-area-inset-bottom));
        }
        .card { border-radius: 22px; }
        .primary, .side { padding: 20px; }
        .brand { margin-bottom: 22px; }
        .brand-badge { width: 40px; height: 40px; border-radius: 12px; }
        h1 { font-size: clamp(2rem, 11vw, 2.75rem); }
        .lede { font-size: 15px; line-height: 1.65; }
        .meta-item { padding: 14px; border-radius: 16px; }
        .warning { padding: 14px 15px; border-radius: 16px; font-size: 14px; }
        .actions { flex-direction: column; }
        .button { width: 100%; min-height: 54px; }
        .download-item { min-height: 58px; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
        }
      }
    </style>
  </head>
  <body>
    ${body}
    <script>
      (() => {
        const button = document.querySelector("[data-copy-url]");
        if (!(button instanceof HTMLButtonElement)) return;

        const label = button.querySelector(".copy-label");
        const originalLabel = label?.textContent || "Copy link";

        async function copyText(value) {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return;
          }

          const textarea = document.createElement("textarea");
          textarea.value = value;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();
          const copied = document.execCommand("copy");
          textarea.remove();
          if (!copied) throw new Error("Copy failed");
        }

        button.addEventListener("click", async () => {
          const url = button.dataset.copyUrl;
          if (!url) return;

          try {
            await copyText(url);
            button.dataset.copied = "true";
            if (label) label.textContent = "Copied";
            window.setTimeout(() => {
              button.dataset.copied = "false";
              if (label) label.textContent = originalLabel;
            }, 2200);
          } catch {
            window.prompt("Copy this CAIDE share link:", url);
          }
        });
      })();
    </script>
  </body>
</html>`;
}

function brandIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-hidden="true" fill="none"><path d="M196 62A96 96 0 1 0 196 194" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/><circle cx="128" cy="128" r="22" fill="#fff"/></svg>`;
}

export function shareCardSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="CAIDE project sharing"><defs><radialGradient id="g" cx="50%" cy="0%" r="90%"><stop offset="0%" stop-color="#272b31"/><stop offset="58%" stop-color="#080a0d"/><stop offset="100%" stop-color="#030507"/></radialGradient><filter id="blur"><feGaussianBlur stdDeviation="44"/></filter></defs><rect width="1200" height="630" fill="url(#g)"/><circle cx="1030" cy="90" r="210" fill="#fff" opacity=".08" filter="url(#blur)"/><circle cx="155" cy="590" r="210" fill="#7d8590" opacity=".08" filter="url(#blur)"/><g transform="translate(92 92)"><rect width="108" height="108" rx="30" fill="#0a0c0f" stroke="#fff" stroke-opacity=".12"/><path d="M78 29A40 40 0 1 0 78 79" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"/><circle cx="54" cy="54" r="9" fill="#fff"/></g><text x="230" y="142" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700">CAIDE</text><text x="92" y="310" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="72" font-weight="750" letter-spacing="-3">Open a shared project</text><text x="92" y="382" fill="#a9b1bd" font-family="Inter,Arial,sans-serif" font-size="30">Review the snapshot, then continue in the CAIDE desktop app.</text><g transform="translate(92 468)"><rect width="310" height="64" rx="18" fill="#fff"/><text x="155" y="42" fill="#08090c" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="22" font-weight="700">Open in CAIDE</text></g><text x="1108" y="548" fill="#7f8793" text-anchor="end" font-family="Inter,Arial,sans-serif" font-size="20">Secure project handoff</text></svg>`;
}

export function unavailableSharePage(title: string, description: string): string {
  return pageShell({
    title,
    description,
    body: `<main class="shell"><section class="card status-card"><div class="primary"><div class="brand"><div class="brand-badge">${brandIcon()}</div><div class="brand-text"><span class="eyebrow">Shared with CAIDE</span><span class="brand-name">CAIDE Project Sharing</span></div></div><div class="pill"><span class="bullet" style="background:#f0ad7e; box-shadow:0 0 16px rgba(240,173,126,0.45);"></span>Link unavailable</div><h1>${escapeHtml(title)}</h1><p class="lede">${escapeHtml(description)}</p><div class="warning"><strong>Heads up:</strong> this share link may have expired, been revoked, or reached its download limit. Ask the sender to create a new CAIDE share link if you still need access.</div><div class="actions"><a class="button secondary" href="${escapeHtml(config.CAIDE_DOWNLOAD_WINDOWS)}">Download CAIDE</a></div></div></section></main>`,
  });
}

export function serviceHomePage(): string {
  return pageShell({
    title: "CAIDE Share Service",
    description: "CAIDE project sharing service is online.",
    body: `<main class="shell"><section class="card status-card"><div class="primary"><div class="brand"><div class="brand-badge">${brandIcon()}</div><div class="brand-text"><span class="eyebrow">Service status</span><span class="brand-name">CAIDE Share Service</span></div></div><div class="pill"><span class="bullet"></span>Online</div><h1>Project sharing is live.</h1><p class="lede">This service powers CAIDE share links, share metadata, and download handoff for desktop clients. Shared project pages are available under <code>/s/&lt;token&gt;</code>.</p><div class="meta-grid"><div class="meta-item"><div class="meta-label">Health</div><div class="meta-value"><a style="color:inherit" href="/healthz">/healthz</a></div></div><div class="meta-item"><div class="meta-label">Landing page</div><div class="meta-value">/s/&lt;token&gt;</div></div><div class="meta-item"><div class="meta-label">API base</div><div class="meta-value">/v1</div></div></div><div class="footer-note">If you are trying to open a shared project, use the full CAIDE share link you received from the sender.</div></div></section></main>`,
  });
}

export function landingPage(row: ShareRow, token: string): string {
  const name = escapeHtml(row.project_name);
  const deepLink = `caide://receive-project?token=${encodeURIComponent(token)}`;
  const shareUrl = `${config.SHARE_PUBLIC_BASE_URL}/s/${encodeURIComponent(token)}`;
  const size = formatBytes(Number(row.package_size));
  const state = resolveShareState(row);
  const isUnavailable = state !== "active";
  const windowsUrl = escapeHtml(config.CAIDE_DOWNLOAD_WINDOWS);
  const linuxUrl = escapeHtml(config.CAIDE_DOWNLOAD_LINUX);
  const macosUrl = escapeHtml(config.CAIDE_DOWNLOAD_MACOS);

  const title = isUnavailable
    ? `${name} — CAIDE share unavailable`
    : `${name} — Open in CAIDE`;
  const description = isUnavailable
    ? "This CAIDE project link is no longer available."
    : "Open this CAIDE project snapshot in the desktop app.";

  const stateTitle =
    state === "expired"
      ? "This project link has expired"
      : state === "revoked"
        ? "This project link was revoked"
        : state === "download-limit"
          ? "This project link reached its download limit"
          : name;

  const stateDescription =
    state === "expired"
      ? "The sender created this share with a time limit, and that limit has passed."
      : state === "revoked"
        ? "The sender disabled this CAIDE share link, so it can no longer be opened."
        : state === "download-limit"
          ? "This share already reached its maximum number of downloads."
          : "A CAIDE project snapshot was shared with you. Review it in CAIDE before downloading dependencies or running any code.";

  const metadata = isUnavailable
    ? ""
    : `<div class="meta-grid"><div class="meta-item"><div class="meta-label">Package size</div><div class="meta-value">${size}</div></div><div class="meta-item"><div class="meta-label">Expires</div><div class="meta-value">${escapeHtml(row.expires_at.toLocaleDateString())}</div></div><div class="meta-item"><div class="meta-label">Downloads</div><div class="meta-value">${row.max_downloads === null ? `${row.download_count} used` : `${row.download_count}/${row.max_downloads}`}</div></div></div>`;

  const actions = isUnavailable
    ? ""
    : `<div class="actions"><a class="button primary" href="${deepLink}"><span>Open in CAIDE</span><span aria-hidden="true">↗</span></a><button class="button secondary copy-button" type="button" data-copy-url="${escapeHtml(shareUrl)}" data-copied="false"><span class="copy-label">Copy link</span></button></div>`;

  return pageShell({
    title,
    description,
    canonicalUrl: shareUrl,
    body: `<main class="shell"><section class="card"><div class="primary"><div class="brand"><div class="brand-badge">${brandIcon()}</div><div class="brand-text"><span class="eyebrow">Shared with CAIDE</span><span class="brand-name">CAIDE Project Sharing</span></div></div><div class="pill"><span class="bullet"${isUnavailable ? " style=\"background:#f0ad7e; box-shadow:0 0 16px rgba(240,173,126,0.45);\"" : ""}></span>${isUnavailable ? "Unavailable" : "Ready to open"}</div><h1>${stateTitle}</h1><p class="lede">${stateDescription}</p>${metadata}<div class="warning"><strong>Security reminder:</strong> shared projects may contain untrusted code. CAIDE imports the project snapshot, but you should still review files before installing dependencies or running commands.</div>${actions}</div><aside class="side"><h2 class="side-title">Get CAIDE</h2><p class="side-copy">If CAIDE is not installed yet, download it for your platform and then reopen this share link.</p><div class="download-list"><a class="download-item" href="${windowsUrl}"><div><div class="download-name">Windows</div><div class="download-caption">Desktop app</div></div><span>↗</span></a><a class="download-item" href="${linuxUrl}"><div><div class="download-name">Linux</div><div class="download-caption">Desktop app</div></div><span>↗</span></a><a class="download-item" href="${macosUrl}"><div><div class="download-name">macOS</div><div class="download-caption">Desktop app</div></div><span>↗</span></a></div><div class="footer-note">Share pages are only a handoff layer. Project import happens inside the CAIDE desktop application via the <code>caide://</code> protocol.</div></aside></section></main>`,
  });
}
