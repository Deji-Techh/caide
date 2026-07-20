import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

// =============================================================================
// Release Schemas
// =============================================================================

export const AppIdParamsSchema = z.object({
  appId: z.number(),
});

export const BuildTargetSchema = z.enum([
  "web",
  "pwa",
  "android-project",
  "apk-debug",
  "apk-signed",
  "aab-signed",
  "ios-project",
]);

export type BuildTarget = z.infer<typeof BuildTargetSchema>;

export const BuildLogSchema = z.object({
  id: z.string(),
  target: BuildTargetSchema,
  status: z.enum(["pending", "running", "success", "failed"]),
  message: z.string(),
  timestamp: z.number(),
  details: z.string().optional(),
});

export type BuildLog = z.infer<typeof BuildLogSchema>;

export const BuildResultSchema = z.object({
  success: z.boolean(),
  logs: z.array(BuildLogSchema),
  outputPath: z.string().optional(),
  artifactPaths: z.array(z.string()).optional(),
});

export type BuildResult = z.infer<typeof BuildResultSchema>;

export const KeystoreConfigSchema = z.object({
  keystorePath: z.string(),
  keyAlias: z.string(),
  storePasswordStored: z.boolean(),
  keyPasswordStored: z.boolean(),
  validityDays: z.number(),
  organization: z.string().optional(),
  organizationalUnit: z.string().optional(),
  countryCode: z.string().optional(),
});

export type KeystoreConfig = z.infer<typeof KeystoreConfigSchema>;

export const StoreConfigSchema = z.object({
  appName: z.string(),
  versionName: z.string(),
  versionCode: z.number(),
  packageId: z.string(),
  iconPath: z.string().optional(),
  splashScreenPath: z.string().optional(),
  privacyPolicyUrl: z.string().optional(),
  permissionsExplanation: z.string().optional(),
  playStoreDescription: z.string().optional(),
});

export type StoreConfig = z.infer<typeof StoreConfigSchema>;

export const VerificationIssueSchema = z.object({
  category: z.enum([
    "env-vars",
    "broken-routes",
    "type-errors",
    "accessibility",
    "unsupported-api",
    "oversized-assets",
    "secret-detection",
  ]),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
});

export type VerificationIssue = z.infer<typeof VerificationIssueSchema>;

export const VerificationResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(VerificationIssueSchema),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const DependencyDiagnosticSchema = z.object({
  name: z.string(),
  version: z.string(),
  isInstalled: z.boolean(),
  isOptional: z.boolean(),
  message: z.string().optional(),
});

export type DependencyDiagnostic = z.infer<typeof DependencyDiagnosticSchema>;

export const QualityGateStatusSchema = z.enum([
  "idle",
  "generating",
  "building",
  "type-checking",
  "previewing",
  "testing-viewports",
  "scanning-overflow",
  "checking-accessibility",
  "capturing-screenshots",
  "ai-reviewing",
  "repairing",
  "passed",
  "failed",
]);

export type QualityGateStatus = z.infer<typeof QualityGateStatusSchema>;

// =============================================================================
// Release Contracts
// =============================================================================

export const releaseContracts = {
  buildApp: defineContract({
    channel: "release-build-app",
    input: z.object({
      appId: z.number(),
      target: BuildTargetSchema,
    }),
    output: BuildResultSchema,
  }),

  buildAll: defineContract({
    channel: "release-build-all",
    input: AppIdParamsSchema,
    output: BuildResultSchema,
  }),

  checkDependencies: defineContract({
    channel: "release-check-deps",
    input: AppIdParamsSchema,
    output: z.array(DependencyDiagnosticSchema),
  }),

  getBuildLogs: defineContract({
    channel: "release-get-logs",
    input: AppIdParamsSchema,
    output: z.array(BuildLogSchema),
  }),

  generateKeystore: defineContract({
    channel: "release-generate-keystore",
    input: z.object({
      appId: z.number(),
      config: KeystoreConfigSchema.partial(),
    }),
    output: KeystoreConfigSchema,
  }),

  verifyKeystore: defineContract({
    channel: "release-verify-keystore",
    input: AppIdParamsSchema,
    output: z.boolean(),
  }),

  saveStoreConfig: defineContract({
    channel: "release-save-store-config",
    input: z.object({
      appId: z.number(),
      config: StoreConfigSchema,
    }),
    output: z.void(),
  }),

  getStoreConfig: defineContract({
    channel: "release-get-store-config",
    input: AppIdParamsSchema,
    output: StoreConfigSchema.nullable(),
  }),

  runVerification: defineContract({
    channel: "release-run-verification",
    input: AppIdParamsSchema,
    output: VerificationResultSchema,
  }),

  runQualityGate: defineContract({
    channel: "release-run-quality-gate",
    input: AppIdParamsSchema,
    output: z.object({
      passed: z.boolean(),
      status: QualityGateStatusSchema,
      logs: z.array(BuildLogSchema),
      issues: z.array(VerificationIssueSchema),
    }),
  }),

  getQualityGateStatus: defineContract({
    channel: "release-quality-gate-status",
    input: AppIdParamsSchema,
    output: z.object({
      status: QualityGateStatusSchema,
      progress: z.number(),
      currentStep: z.string(),
    }),
  }),
} as const;

// =============================================================================
// Release Client
// =============================================================================

export const releaseClient = createClient(releaseContracts);
