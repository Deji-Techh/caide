import { describe, expect, it } from "vitest";
import { isSafePublicPreviewPath } from "./public_preview_security";

describe("public preview file filtering", () => {
  it("excludes credentials and private environment files", () => {
    expect(isSafePublicPreviewPath(".env")).toBe(false);
    expect(isSafePublicPreviewPath("config/service-account.json")).toBe(false);
    expect(isSafePublicPreviewPath("certs/private.pem")).toBe(false);
  });

  it("allows documented environment templates", () => {
    expect(isSafePublicPreviewPath(".env.example")).toBe(true);
    expect(isSafePublicPreviewPath("src/App.tsx")).toBe(true);
  });
});
