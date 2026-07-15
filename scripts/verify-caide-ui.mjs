import { _electron as electron } from "playwright";
import path from "node:path";

const executablePath = path.resolve("node_modules/electron/dist/electron");
const packagedApp = path.resolve(
  "out/CAIDE Mobile Builder-linux-x64/resources/app.asar",
);

const app = await electron.launch({
  executablePath,
  args: [packagedApp, "--no-sandbox"],
  env: {
    ...process.env,
    NODE_ENV: "production",
    DYAD_DISABLE_AUTO_UPDATE: "true",
  },
  timeout: 120_000,
});

try {
  const window = await app.firstWindow({ timeout: 120_000 });
  const errors = [];
  window.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  window.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await window.waitForLoadState("domcontentloaded");
  await window.locator(".caide-shell").waitFor({ timeout: 120_000 });
  await window.waitForTimeout(2_000);
  await window.setViewportSize({ width: 1600, height: 1000 });
  await window.screenshot({ path: "/tmp/caide-electron-desktop.png" });

  const desktop = await window.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyScroll: {
        width: document.body.scrollWidth,
        height: document.body.scrollHeight,
      },
      shell: rect(".caide-shell"),
      stage: rect(".caide-stage"),
      phone: rect(".caide-phone"),
      prompt: rect(".caide-prompt-panel"),
      inspector: rect(".caide-inspector"),
    };
  });

  await window.setViewportSize({ width: 800, height: 900 });
  await window.waitForTimeout(500);
  await window.screenshot({
    path: "/tmp/caide-electron-compact.png",
    fullPage: true,
  });
  const compactOverflow = await window.evaluate(() => ({
    viewportWidth: innerWidth,
    bodyWidth: document.body.scrollWidth,
    shellWidth: document.querySelector(".caide-shell")?.scrollWidth ?? null,
  }));

  console.log(JSON.stringify({ desktop, compactOverflow, errors }, null, 2));
} finally {
  await app.close();
}
