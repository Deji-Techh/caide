import { z } from "zod";

export const CAIDE_PACKAGE_FORMAT = "caide-project" as const;
export const CAIDE_PACKAGE_VERSION = 1 as const;
export const CAIDE_PACKAGE_EXTENSION = ".caidepkg" as const;

export const ProjectPackageManifestSchema = z.object({
  format: z.literal(CAIDE_PACKAGE_FORMAT),
  formatVersion: z.literal(CAIDE_PACKAGE_VERSION),
  projectId: z.string().uuid(),
  projectName: z.string().min(1).max(160),
  caideVersion: z.string().min(1),
  createdAt: z.string().datetime(),
  includes: z.object({
    workspace: z.literal(true),
    gitHistory: z.boolean(),
    chatHistory: z.boolean(),
    media: z.boolean(),
  }),
  limits: z.object({
    fileCount: z.number().int().nonnegative(),
    uncompressedBytes: z.number().int().nonnegative(),
  }),
});

export type ProjectPackageManifest = z.infer<
  typeof ProjectPackageManifestSchema
>;

export const ProjectPackageSecurityReportSchema = z.object({
  excludedFiles: z.array(z.string()),
  excludedDirectories: z.array(z.string()),
  skippedSymlinks: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ProjectPackageSecurityReport = z.infer<
  typeof ProjectPackageSecurityReportSchema
>;

export const ProjectPackageInspectionSchema = z.object({
  path: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  manifest: ProjectPackageManifestSchema,
  chatCount: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
  versionCount: z.number().int().nonnegative(),
  securityReport: ProjectPackageSecurityReportSchema,
});

export type ProjectPackageInspection = z.infer<
  typeof ProjectPackageInspectionSchema
>;

export const ProjectPackageMetadataSchema = z.object({
  app: z.record(z.string(), z.unknown()),
  chats: z.array(z.record(z.string(), z.unknown())),
  messages: z.array(z.record(z.string(), z.unknown())),
  versions: z.array(z.record(z.string(), z.unknown())),
  securityReport: ProjectPackageSecurityReportSchema,
});

export type ProjectPackageMetadata = z.infer<
  typeof ProjectPackageMetadataSchema
>;
