import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";

const executablePath = path.resolve(
  "out/CAIDE Mobile Builder-linux-x64/CAIDE Mobile Builder",
);
const sourceUserData = path.join(
  os.homedir(),
  ".config",
  "CAIDE Mobile Builder",
);
const verificationUserData = path.join(os.tmpdir(), "caide-ui-verification");

fs.rmSync(verificationUserData, { recursive: true, force: true });
fs.mkdirSync(verificationUserData, { recursive: true });
for (const file of ["user-settings.json", "chatgpt-session.json"]) {
  const source = path.join(sourceUserData, file);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(verificationUserData, file));
  }
}
const sourceDatabase = path.join(sourceUserData, "sqlite.db");
if (fs.existsSync(sourceDatabase)) {
  const verificationDatabase = path.join(verificationUserData, "sqlite.db");
  execFileSync("sqlite3", [
    sourceDatabase,
    `.backup '${verificationDatabase}'`,
  ]);
  isolateLatestProject(verificationDatabase, verificationUserData);
}

const debuggingPort = 39_321;
const app = spawn(
  executablePath,
  [
    "--no-sandbox",
    `--user-data-dir=${verificationUserData}`,
    `--remote-debugging-port=${debuggingPort}`,
  ],
  {
    stdio: "ignore",
    detached: false,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DYAD_DISABLE_AUTO_UPDATE: "true",
    },
  },
);

await waitForDebuggingPort(debuggingPort);
const browser = await chromium.connectOverCDP(
  `http://127.0.0.1:${debuggingPort}`,
);

try {
  const context = browser.contexts()[0];
  const window = await waitForMainWindow(context);
  const errors = [];
  window.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  window.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await window.waitForLoadState("domcontentloaded");
  await window.setViewportSize({ width: 1600, height: 1000 });
  const initialScreen = await Promise.race([
    window
      .locator("[data-testid=caide-overview]")
      .waitFor({ timeout: 120_000 })
      .then(() => "overview"),
    window
      .locator("[data-testid=caide-workspace]")
      .waitFor({ timeout: 120_000 })
      .then(() => "workspace"),
    window
      .locator("[data-testid=caide-settings]")
      .waitFor({ timeout: 120_000 })
      .then(() => "settings"),
  ]);
  if (initialScreen === "workspace") {
    await window.locator(".caide-back").click();
  } else if (initialScreen === "settings") {
    await window.getByRole("button", { name: "Back to workspace" }).click();
  }
  await window
    .locator("[data-testid=caide-overview]")
    .waitFor({ timeout: 120_000 });
  await window.waitForTimeout(1_500);
  await window.screenshot({ path: "/tmp/caide-overview-desktop.png" });

  const overview = await measure(window, [
    ".caide-overview",
    ".caide-overview-sidebar",
    ".caide-overview-header",
    ".caide-overview-heading",
    ".caide-overview-grid",
    ".caide-starting-points",
  ]);

  await window.locator(".caide-header-icon[aria-label=Settings]").click();
  await window.locator("[data-testid=caide-settings]").waitFor();
  await window.waitForTimeout(300);
  const greyTheme = await window.evaluate(() => ({
    rootClass: document.documentElement.className,
    fontFamily: getComputedStyle(document.body).fontFamily,
    pageBackground: getComputedStyle(document.querySelector(".caide-settings"))
      .backgroundColor,
    cardBackground: getComputedStyle(
      document.querySelector(".caide-settings-grid > div"),
    ).backgroundColor,
    bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
  }));
  await window.screenshot({ path: "/tmp/caide-settings-grey.png" });

  await window.getByRole("button", { name: "Light", exact: true }).click();
  await window.locator("html.light").waitFor();
  await window.waitForTimeout(300);
  const lightTheme = await window.evaluate(() => ({
    rootClass: document.documentElement.className,
    fontFamily: getComputedStyle(document.body).fontFamily,
    pageBackground: getComputedStyle(document.querySelector(".caide-settings"))
      .backgroundColor,
    cardBackground: getComputedStyle(
      document.querySelector(".caide-settings-grid > div"),
    ).backgroundColor,
    bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
  }));
  await window.screenshot({ path: "/tmp/caide-settings-light.png" });
  await window.getByRole("button", { name: "Back to workspace" }).click();
  await window.locator("[data-testid=caide-overview]").waitFor();
  await window.waitForTimeout(300);
  const lightOverview = await window.evaluate(() => {
    const background = (selector) =>
      getComputedStyle(document.querySelector(selector)).backgroundColor;
    const color = (selector) =>
      getComputedStyle(document.querySelector(selector)).color;
    return {
      sidebarBackground: background(".caide-overview-sidebar"),
      headerBackground: background(".caide-overview-header"),
      workbenchBackground: background(".caide-brief-workbench"),
      historyBackground: background(".caide-history-panel"),
      headingColor: color(".caide-overview-heading h1"),
      bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
    };
  });
  await window.screenshot({ path: "/tmp/caide-overview-light.png" });

  await window.getByRole("button", { name: "Open project backup" }).click();
  await window.locator(".caide-backup-library").waitFor();
  await window.waitForTimeout(250);
  const lightBackup = await window.evaluate(() => {
    const background = (selector) =>
      getComputedStyle(document.querySelector(selector)).backgroundColor;
    return {
      page: background(".caide-backup-library"),
      topbar: background(".caide-backup-topbar"),
      toolbar: background(".caide-backup-toolbar"),
      projectList: background(".caide-backup-project-list"),
      bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
    };
  });
  if (
    ![
      lightBackup.page,
      lightBackup.topbar,
      lightBackup.toolbar,
      lightBackup.projectList,
    ].every(isLightColor)
  ) {
    throw new Error(
      `Light project backup contains a dark shell surface: ${JSON.stringify(lightBackup)}`,
    );
  }
  await window.screenshot({ path: "/tmp/caide-project-backup-light.png" });
  await window.getByRole("button", { name: "Overview" }).click();
  await window.locator("[data-testid=caide-overview]").waitFor();

  await window.locator(".caide-header-icon[aria-label=Settings]").click();
  await window.locator("[data-testid=caide-settings]").waitFor();
  await window.getByRole("button", { name: "Grey", exact: true }).click();
  await window.locator("html.dark").waitFor();
  await window.getByRole("button", { name: "Back to workspace" }).click();
  await window.locator("[data-testid=caide-overview]").waitFor();

  const projectButton = window
    .locator(".caide-history-row > button:first-child")
    .first();
  const hasProject = (await projectButton.count()) > 0;
  let workspace = null;
  if (hasProject) {
    await projectButton.click();
    await window
      .locator("[data-testid=caide-workspace]")
      .waitFor({ timeout: 120_000 });
    await window
      .locator(".caide-preview-viewport iframe")
      .waitFor({ state: "visible", timeout: 60_000 })
      .catch(() => undefined);
    await selectDevice(window, "iPhone SE");
    await window.waitForTimeout(1_000);
    await window.screenshot({ path: "/tmp/caide-workspace-desktop.png" });
    workspace = await measure(window, [
      ".caide-workspace",
      ".caide-project-header",
      ".caide-tool-rail",
      ".caide-screen-map",
      ".caide-builder-stage",
      ".caide-preview-frame",
      ".caide-command-tray",
      ".caide-properties",
    ]);
    workspace.previewPortrait = await measurePreviewFit(window);

    const mobilePreviewButton = window.getByTestId(
      "caide-mobile-preview-button",
    );
    await mobilePreviewButton.waitFor({ state: "visible", timeout: 120_000 });
    await expectEnabled(mobilePreviewButton, 120_000);
    await mobilePreviewButton.click();
    const qrCode = window.getByAltText("QR code for mobile preview");
    await qrCode.waitFor({ state: "visible", timeout: 30_000 });
    const mobilePreviewUrl = await qrCode.evaluate((image) => {
      const container = image.parentElement;
      const candidate = [...(container?.querySelectorAll("p") ?? [])].find(
        (paragraph) => paragraph.textContent?.trim().startsWith("http"),
      );
      return candidate?.textContent?.trim() ?? "";
    });
    const parsedMobilePreviewUrl = new URL(mobilePreviewUrl);
    if (
      ["localhost", "127.0.0.1", "0.0.0.0"].includes(
        parsedMobilePreviewUrl.hostname,
      )
    ) {
      throw new Error(
        `Mobile preview did not expose a LAN address: ${mobilePreviewUrl}`,
      );
    }
    const mobileResponse = await fetch(mobilePreviewUrl, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!mobileResponse.ok) {
      throw new Error(
        `Mobile preview URL returned ${mobileResponse.status}: ${mobilePreviewUrl}`,
      );
    }
    const desktopIframeUrl = await window
      .locator(".caide-preview-viewport iframe")
      .getAttribute("src");
    if (
      desktopIframeUrl &&
      !["localhost", "127.0.0.1"].includes(new URL(desktopIframeUrl).hostname)
    ) {
      throw new Error(
        `Desktop preview changed away from localhost: ${desktopIframeUrl}`,
      );
    }
    workspace.mobilePreview = {
      url: mobilePreviewUrl,
      responseStatus: mobileResponse.status,
      desktopIframeUrl,
      qrImageWidth: await qrCode.evaluate((image) => image.clientWidth),
    };
    await window.screenshot({ path: "/tmp/caide-mobile-preview.png" });
    await qrCode
      .locator("xpath=..")
      .getByRole("button", { name: "Disable mobile preview", exact: true })
      .click();
    await qrCode.waitFor({ state: "detached", timeout: 30_000 });
    await expectEnabled(mobilePreviewButton, 30_000);
    if (
      (await mobilePreviewButton.getAttribute("aria-label")) !==
      "Mobile preview"
    ) {
      throw new Error("Mobile preview did not return to its disabled state");
    }

    await window.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await window.waitForTimeout(250);
    workspace.lightTheme = await window.evaluate(() => {
      const background = (selector) =>
        getComputedStyle(document.querySelector(selector)).backgroundColor;
      const color = (selector) =>
        getComputedStyle(document.querySelector(selector)).color;
      return {
        header: background(".caide-project-header"),
        toolRail: background(".caide-tool-rail"),
        screenMap: background(".caide-screen-map"),
        toolbar: background(".caide-builder-toolbar"),
        canvas: background(".caide-canvas-surface"),
        properties: background(".caide-properties"),
        commandTray: background(".caide-command-tray"),
        inspectorText: color(".caide-inspector-heading strong"),
      };
    });
    const lightWorkspaceSurfaces = [
      workspace.lightTheme.header,
      workspace.lightTheme.toolRail,
      workspace.lightTheme.screenMap,
      workspace.lightTheme.toolbar,
      workspace.lightTheme.canvas,
      workspace.lightTheme.properties,
      workspace.lightTheme.commandTray,
    ];
    if (!lightWorkspaceSurfaces.every(isLightColor)) {
      throw new Error(
        `Light workspace contains a dark shell surface: ${JSON.stringify(workspace.lightTheme)}`,
      );
    }
    await window.screenshot({ path: "/tmp/caide-workspace-light.png" });
    await window.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
    await window.waitForTimeout(250);

    await window
      .getByRole("button", { name: /Use landscape orientation/i })
      .click();
    await window.waitForTimeout(450);
    workspace.previewLandscape = await measurePreviewFit(window);
    await window
      .getByRole("button", { name: /Use portrait orientation/i })
      .click();

    await window
      .getByRole("button", { name: "Open full-screen app preview" })
      .click();
    await window.locator(".caide-workspace.is-immersive-preview").waitFor();
    await window.waitForTimeout(500);
    workspace.immersivePreview = await window.evaluate(() => {
      const isVisible = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const bounds = element.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0;
      };
      const iframe = document.querySelector(".caide-preview-viewport iframe");
      return {
        projectHeaderVisible: isVisible(".caide-project-header"),
        previewToolbarVisible: isVisible(".caide-builder-toolbar"),
        exitButtonVisible: isVisible(
          '[aria-label="Exit full-screen app preview"]',
        ),
        toolRailVisible: isVisible(".caide-tool-rail"),
        screenMapVisible: isVisible(".caide-screen-map"),
        propertiesVisible: isVisible(".caide-properties"),
        commandTrayVisible: isVisible(".caide-command-tray"),
        iframePointerEvents: iframe
          ? getComputedStyle(iframe).pointerEvents
          : null,
        panCapturePresent: Boolean(
          document.querySelector(".caide-pan-capture"),
        ),
      };
    });
    await window.screenshot({ path: "/tmp/caide-immersive-preview.png" });
    await window.keyboard.press("Escape");
    await window
      .locator(".caide-workspace.is-immersive-preview")
      .waitFor({ state: "detached" });

    await selectDevice(window, "Responsive");
    await window.waitForTimeout(450);
    const responsiveBefore = await measurePreviewFit(window);
    const resizeHandle = window.getByRole("button", {
      name: "Resize responsive preview",
    });
    await resizeHandle.waitFor();
    const resizeBounds = await resizeHandle.boundingBox();
    if (!resizeBounds)
      throw new Error("Responsive resize handle is not visible");
    await window.mouse.move(
      resizeBounds.x + resizeBounds.width / 2,
      resizeBounds.y + resizeBounds.height / 2,
    );
    await window.mouse.down();
    await window.mouse.move(
      resizeBounds.x + resizeBounds.width / 2 + 80,
      resizeBounds.y + resizeBounds.height / 2 + 55,
      { steps: 8 },
    );
    await window.mouse.up();
    await window.waitForTimeout(250);
    const responsiveAfter = await measurePreviewFit(window);
    workspace.responsiveResize = {
      before: responsiveBefore,
      after: responsiveAfter,
      dimensionsChanged:
        responsiveBefore?.deviceClient[0] !==
          responsiveAfter?.deviceClient[0] ||
        responsiveBefore?.deviceClient[1] !== responsiveAfter?.deviceClient[1],
      triggerText: await window
        .getByRole("button", { name: "Preview device" })
        .innerText(),
    };
    await window.screenshot({ path: "/tmp/caide-responsive-resize.png" });

    await window.getByRole("button", { name: "Agent" }).click();
    await window.locator("[data-testid=chat-panel]").waitFor();
    await window.waitForTimeout(700);
    await window.screenshot({ path: "/tmp/caide-agent-panel.png" });
    workspace.agent = await window.evaluate(() => {
      const panel = document.querySelector(".caide-agent-panel");
      const messages = document.querySelector('[data-testid="messages-list"]');
      return {
        panelClientWidth: panel?.clientWidth ?? 0,
        panelScrollWidth: panel?.scrollWidth ?? 0,
        messagesClientWidth: messages?.clientWidth ?? 0,
        messagesScrollWidth: messages?.scrollWidth ?? 0,
        renderedMessages: document.querySelectorAll("[data-message-role]")
          .length,
      };
    });

    await window
      .locator(".caide-agent-panel")
      .getByTestId("chat-mode-selector")
      .click();
    await window.getByText("Doctor", { exact: true }).click();
    await window.getByRole("heading", { name: "CAIDE Doctor" }).waitFor();
    await window.getByText("Auditing the entire app").waitFor();
    await window.waitForTimeout(500);
    workspace.doctor = await window.evaluate(() => {
      const dialog = document.querySelector('[data-slot="dialog-content"]');
      return {
        width: dialog?.clientWidth ?? 0,
        scrollWidth: dialog?.scrollWidth ?? 0,
        stageCount: dialog?.querySelectorAll(".divide-y > div").length ?? 0,
        hasAnimatedScanner: Boolean(dialog?.querySelector(".animate-spin")),
      };
    });
    if (
      workspace.doctor.width < 640 ||
      workspace.doctor.scrollWidth > workspace.doctor.width ||
      workspace.doctor.stageCount !== 6 ||
      !workspace.doctor.hasAnimatedScanner
    ) {
      throw new Error(
        `Doctor dialog failed responsive layout checks: ${JSON.stringify(workspace.doctor)}`,
      );
    }
    await window.screenshot({ path: "/tmp/caide-doctor-running.png" });
    await window
      .getByTestId("caide-doctor-dialog")
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click();

    const devicePicker = window.getByRole("button", {
      name: "Preview device",
    });
    await devicePicker.click();
    await window.getByPlaceholder("Search devices...").waitFor();
    workspace.devicePicker = {
      options: await window.locator(".caide-device-picker-option").count(),
      groups: await window.locator("[cmdk-group-heading]").count(),
    };
    await window.screenshot({ path: "/tmp/caide-device-picker.png" });
    await window.keyboard.press("Escape");

    await window.getByRole("button", { name: "Project settings" }).click();
    await window.locator("[data-testid=app-details-page]").waitFor();
    await window.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    });
    await window.waitForTimeout(250);
    workspace.lightProjectDetails = await window.evaluate(() => {
      const background = (selector) =>
        getComputedStyle(document.querySelector(selector)).backgroundColor;
      return {
        page: background(".caide-project-details"),
        toolbar: background(".caide-details-toolbar"),
        previewSection: background(".caide-details-preview-section"),
        facts: background(".caide-details-facts"),
        operation: background(".caide-details-operation"),
        bodyOverflowX: document.body.scrollWidth - document.body.clientWidth,
      };
    });
    if (
      ![
        workspace.lightProjectDetails.page,
        workspace.lightProjectDetails.toolbar,
        workspace.lightProjectDetails.previewSection,
        workspace.lightProjectDetails.facts,
        workspace.lightProjectDetails.operation,
      ].every(isLightColor)
    ) {
      throw new Error(
        `Light project details contain a dark shell surface: ${JSON.stringify(workspace.lightProjectDetails)}`,
      );
    }
    await window.screenshot({ path: "/tmp/caide-project-details-light.png" });
    await window.getByRole("button", { name: "Projects" }).click();
    await window.locator("[data-testid=caide-workspace]").waitFor();
    await window.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    });
  }

  await window.setViewportSize({ width: 900, height: 850 });
  await window.waitForTimeout(500);
  await window.screenshot({
    path: hasProject
      ? "/tmp/caide-workspace-compact.png"
      : "/tmp/caide-overview-compact.png",
  });

  const compact = await window.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    body: {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
    },
    route: location.pathname,
  }));

  console.log(
    JSON.stringify(
      {
        overview,
        greyTheme,
        lightTheme,
        lightOverview,
        lightBackup,
        hasProject,
        workspace,
        compact,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await stopChildProcess(app);
}

async function waitForDebuggingPort(port) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Electron is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Electron debugging port");
}

function isolateLatestProject(databasePath, targetRoot) {
  const latest = execFileSync("sqlite3", [
    "-separator",
    "\t",
    databasePath,
    "select id, path from apps order by updated_at desc limit 1;",
  ])
    .toString()
    .trim();
  if (!latest) return;

  const [appId, storedPath] = latest.split("\t");
  const sourcePath = path.isAbsolute(storedPath)
    ? storedPath
    : path.join(os.homedir(), "dyad-apps", storedPath);
  const isolatedPath = path.join(targetRoot, "smoke-project");
  fs.cpSync(sourcePath, isolatedPath, {
    recursive: true,
    filter: (entry) =>
      ![".git", "dist", "node_modules"].includes(path.basename(entry)),
  });
  const escapedPath = isolatedPath.replaceAll("'", "''");
  execFileSync("sqlite3", [
    databasePath,
    `update apps set path = '${escapedPath}' where id = ${Number(appId)};`,
  ]);
}

async function waitForMainWindow(context) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    for (const candidate of context.pages()) {
      if (candidate.isClosed()) continue;
      const title = await candidate.title().catch(() => "");
      const hasCaideRoot = await candidate
        .locator(
          "[data-testid=caide-overview], [data-testid=caide-workspace], [data-testid=caide-settings]",
        )
        .count()
        .catch(() => 0);
      if (title === "CAIDE Mobile Builder" || hasCaideRoot > 0) {
        return candidate;
      }
    }
    await Promise.race([
      context.waitForEvent("page", { timeout: 500 }).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);
  }
  throw new Error("Timed out waiting for the CAIDE main window");
}

async function stopChildProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  }
}

async function measure(window, selectors) {
  return window.evaluate((items) => {
    const measured = {};
    for (const selector of items) {
      const element = document.querySelector(selector);
      if (!element) {
        measured[selector] = null;
        continue;
      }
      const bounds = element.getBoundingClientRect();
      measured[selector] = {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        visible: bounds.width > 0 && bounds.height > 0,
      };
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      body: {
        width: document.body.scrollWidth,
        height: document.body.scrollHeight,
      },
      elements: measured,
    };
  }, selectors);
}

async function measurePreviewFit(window) {
  return window.evaluate(() => {
    const device = document.querySelector(".caide-preview-device");
    const viewport = document.querySelector(".caide-preview-viewport");
    const iframe = document.querySelector(".caide-preview-viewport iframe");
    if (!device || !viewport) return null;
    return {
      deviceClient: [device.clientWidth, device.clientHeight],
      viewportOffset: [viewport.offsetWidth, viewport.offsetHeight],
      iframeOffset: iframe ? [iframe.offsetWidth, iframe.offsetHeight] : null,
      frameClass: device.parentElement?.className ?? "",
      exactViewportFit:
        device.clientWidth === viewport.offsetWidth &&
        device.clientHeight === viewport.offsetHeight,
      exactIframeFit:
        !iframe ||
        (viewport.clientWidth === iframe.offsetWidth &&
          viewport.clientHeight === iframe.offsetHeight),
    };
  });
}

async function selectDevice(window, label) {
  await window.getByRole("button", { name: "Preview device" }).click();
  await window.getByPlaceholder("Search devices...").waitFor();
  await window
    .locator(".caide-device-picker-option")
    .filter({ hasText: label })
    .first()
    .click();
}

async function expectEnabled(locator, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await locator.isEnabled().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for control to become enabled");
}

function isLightColor(value) {
  const channels = value
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) return false;
  return channels.reduce((sum, channel) => sum + channel, 0) / 3 >= 180;
}
