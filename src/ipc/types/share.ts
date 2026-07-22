import { z } from "zod";
import { createClient, defineContract } from "../contracts/core";
import {
  ProjectPackageInspectionSchema,
  ProjectPackageManifestSchema,
  ProjectPackageSecurityReportSchema,
} from "@/shared/project_package";

export const ExportProjectPackageParamsSchema = z.object({
  appId: z.number().int().positive(),
  destination: z.string().optional(),
});

export const ExportProjectPackageResultSchema = z.object({
  path: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  manifest: ProjectPackageManifestSchema,
  securityReport: ProjectPackageSecurityReportSchema,
});

export const InspectProjectPackageParamsSchema = z.object({ path: z.string() });
export type InspectProjectPackageParams = z.infer<
  typeof InspectProjectPackageParamsSchema
>;

export const ImportProjectPackageParamsSchema = z.object({
  path: z.string(),
  appName: z.string().min(1).max(160).optional(),
  sourceShareId: z.string().optional(),
  sharedByDisplayName: z.string().max(160).optional(),
});

export const ImportProjectPackageResultSchema = z.object({
  appId: z.number().int().positive(),
  chatId: z.number().int().positive(),
  appName: z.string(),
});

export const RemoteShareMetadataSchema = z.object({
  projectName: z.string(),
  packageVersion: z.number().int().positive(),
  packageSize: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  downloadCount: z.number().int().nonnegative(),
  maxDownloads: z.number().int().positive().nullable(),
  status: z.enum(["active", "pending", "revoked", "expired"]),
});
export type RemoteShareMetadata = z.infer<typeof RemoteShareMetadataSchema>;

export const CreateRemoteShareParamsSchema = z.object({
  appId: z.number().int().positive(),
  expiresInDays: z.number().int().min(1).max(30),
  maxDownloads: z.number().int().min(1).max(1000).optional(),
});
export type CreateRemoteShareParams = z.infer<
  typeof CreateRemoteShareParamsSchema
>;

export const CreateRemoteShareResultSchema = z.object({
  shareId: z.string().uuid(),
  shareUrl: z.string().url(),
  manageToken: z.string().min(20),
  expiresAt: z.string().datetime(),
  packageSize: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type CreateRemoteShareResult = z.infer<
  typeof CreateRemoteShareResultSchema
>;

export const ReceiveRemoteShareParamsSchema = z.object({
  token: z.string().min(20).max(256),
  appName: z.string().min(1).max(160).optional(),
});
export type ReceiveRemoteShareParams = z.infer<
  typeof ReceiveRemoteShareParamsSchema
>;

export const RevokeRemoteShareParamsSchema = z.object({
  shareId: z.string().uuid(),
  manageToken: z.string().min(20),
});
export type RevokeRemoteShareParams = z.infer<
  typeof RevokeRemoteShareParamsSchema
>;

export const shareContracts = {
  selectPackageFile: defineContract({
    channel: "share:select-package-file",
    input: z.void(),
    output: z.object({ path: z.string().nullable() }),
  }),
  exportProjectPackage: defineContract({
    channel: "share:export-project-package",
    input: ExportProjectPackageParamsSchema,
    output: ExportProjectPackageResultSchema,
  }),
  inspectProjectPackage: defineContract({
    channel: "share:inspect-project-package",
    input: InspectProjectPackageParamsSchema,
    output: ProjectPackageInspectionSchema,
  }),
  importProjectPackage: defineContract({
    channel: "share:import-project-package",
    input: ImportProjectPackageParamsSchema,
    output: ImportProjectPackageResultSchema,
  }),
  createRemoteShare: defineContract({
    channel: "share:create-remote",
    input: CreateRemoteShareParamsSchema,
    output: CreateRemoteShareResultSchema,
  }),
  getRemoteShareMetadata: defineContract({
    channel: "share:get-remote-metadata",
    input: z.object({ token: z.string().min(20).max(256) }),
    output: RemoteShareMetadataSchema,
  }),
  consumePendingReceiveToken: defineContract({
    channel: "share:consume-pending-receive-token",
    input: z.void(),
    output: z.object({ token: z.string().nullable() }),
  }),
  receiveRemoteShare: defineContract({
    channel: "share:receive-remote",
    input: ReceiveRemoteShareParamsSchema,
    output: ImportProjectPackageResultSchema,
  }),
  revokeRemoteShare: defineContract({
    channel: "share:revoke-remote",
    input: RevokeRemoteShareParamsSchema,
    output: z.void(),
  }),
} as const;

export const shareClient = createClient(shareContracts);
export type ExportProjectPackageParams = z.infer<
  typeof ExportProjectPackageParamsSchema
>;
export type ExportProjectPackageResult = z.infer<
  typeof ExportProjectPackageResultSchema
>;
export type ImportProjectPackageParams = z.infer<
  typeof ImportProjectPackageParamsSchema
>;
export type ImportProjectPackageResult = z.infer<
  typeof ImportProjectPackageResultSchema
>;

export type { ProjectPackageInspection } from "@/shared/project_package";
