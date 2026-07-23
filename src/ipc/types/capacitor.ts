import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

// =============================================================================
// Capacitor Schemas
// =============================================================================

export const AppIdParamsSchema = z.object({
  appId: z.number(),
});

export const NativeHostPlatformSchema = z.enum([
  "windows",
  "macos",
  "linux",
  "other",
]);

export const NativeToolStateSchema = z.enum([
  "ready",
  "missing",
  "optional",
  "unsupported",
]);

export const NativeToolStatusSchema = z.object({
  id: z.enum([
    "node",
    "java",
    "android-sdk",
    "android-platform",
    "android-build-tools",
    "gradle",
    "adb",
    "android-studio",
    "xcode",
  ]),
  label: z.string(),
  description: z.string(),
  requiredForAndroidBuild: z.boolean(),
  state: NativeToolStateSchema,
  version: z.string().nullable(),
  location: z.string().nullable(),
  remediation: z.string().nullable(),
});

export const NativeAppInfoSchema = z.object({
  name: z.string(),
  packageId: z.string().nullable(),
  versionName: z.string().nullable(),
  versionCode: z.number().int().positive().nullable(),
  webDir: z.string().nullable(),
});

export const NativeArtifactKindSchema = z.enum([
  "debug-apk",
  "release-apk",
  "release-aab",
  "ipa",
]);

export const NativeArtifactSchema = z.object({
  path: z.string(),
  fileName: z.string(),
  kind: NativeArtifactKindSchema,
  sizeBytes: z.number().nonnegative(),
  createdAt: z.string(),
  sha256: z.string().nullable(),
  signed: z.boolean(),
  installable: z.boolean(),
});

export const NativeReleaseStatusSchema = z.object({
  hostPlatform: NativeHostPlatformSchema,
  capacitorInstalled: z.boolean(),
  androidProjectExists: z.boolean(),
  iosProjectExists: z.boolean(),
  canBuildAndroid: z.boolean(),
  canOpenAndroidStudio: z.boolean(),
  canOpenXcode: z.boolean(),
  app: NativeAppInfoSchema,
  tools: z.array(NativeToolStatusSchema),
  artifacts: z.array(NativeArtifactSchema),
});

export const AndroidSigningCredentialsSchema = z.object({
  keystorePath: z.string().min(1),
  keyAlias: z.string().min(1),
  storePassword: z.string().min(1),
  keyPassword: z.string().min(1),
});

export const AndroidBuildTargetSchema = z.enum([
  "debug-apk",
  "release-apk",
  "release-aab",
]);

export const BuildAndroidArtifactParamsSchema = AppIdParamsSchema.extend({
  target: AndroidBuildTargetSchema,
  signing: AndroidSigningCredentialsSchema.nullable(),
});

export const CreateAndroidKeystoreParamsSchema = AppIdParamsSchema.extend({
  keyAlias: z.string().min(1).max(80),
  storePassword: z.string().min(6),
  keyPassword: z.string().min(6),
  commonName: z.string().min(1).max(120),
  organization: z.string().max(120),
  organizationalUnit: z.string().max(120),
  city: z.string().max(120),
  state: z.string().max(120),
  countryCode: z
    .string()
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code"),
  validityYears: z.number().int().min(25).max(100),
});

export const NativeArtifactParamsSchema = AppIdParamsSchema.extend({
  artifactPath: z.string().min(1),
});

export type NativeToolStatus = z.infer<typeof NativeToolStatusSchema>;
export type NativeAppInfo = z.infer<typeof NativeAppInfoSchema>;
export type NativeArtifact = z.infer<typeof NativeArtifactSchema>;
export type NativeArtifactKind = z.infer<typeof NativeArtifactKindSchema>;
export type NativeReleaseStatus = z.infer<typeof NativeReleaseStatusSchema>;
export type AndroidSigningCredentials = z.infer<
  typeof AndroidSigningCredentialsSchema
>;
export type AndroidBuildTarget = z.infer<typeof AndroidBuildTargetSchema>;
export type CreateAndroidKeystoreParams = z.infer<
  typeof CreateAndroidKeystoreParamsSchema
>;

// =============================================================================
// Capacitor Contracts
// =============================================================================

export const capacitorContracts = {
  isCapacitor: defineContract({
    channel: "is-capacitor",
    input: AppIdParamsSchema,
    output: z.boolean(),
  }),

  getNativeReleaseStatus: defineContract({
    channel: "get-native-release-status",
    input: AppIdParamsSchema,
    output: NativeReleaseStatusSchema,
  }),

  syncCapacitor: defineContract({
    channel: "sync-capacitor",
    input: AppIdParamsSchema,
    output: z.void(),
  }),

  buildAndroidArtifact: defineContract({
    channel: "build-android-artifact",
    input: BuildAndroidArtifactParamsSchema,
    output: NativeArtifactSchema,
  }),

  selectAndroidKeystore: defineContract({
    channel: "select-android-keystore",
    input: AppIdParamsSchema,
    output: z.string().nullable(),
  }),

  createAndroidKeystore: defineContract({
    channel: "create-android-keystore",
    input: CreateAndroidKeystoreParamsSchema,
    output: z.string().nullable(),
  }),

  exportNativeArtifact: defineContract({
    channel: "export-native-artifact",
    input: NativeArtifactParamsSchema,
    output: z.string().nullable(),
  }),

  revealNativeArtifact: defineContract({
    channel: "reveal-native-artifact",
    input: NativeArtifactParamsSchema,
    output: z.void(),
  }),

  installAndroidArtifact: defineContract({
    channel: "install-android-artifact",
    input: NativeArtifactParamsSchema,
    output: z.void(),
  }),

  openIos: defineContract({
    channel: "open-ios",
    input: AppIdParamsSchema,
    output: z.void(),
  }),

  openAndroid: defineContract({
    channel: "open-android",
    input: AppIdParamsSchema,
    output: z.void(),
  }),
} as const;

// =============================================================================
// Capacitor Client
// =============================================================================

export const capacitorClient = createClient(capacitorContracts);
