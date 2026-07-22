import { z } from "zod";
import { defineContract, createClient } from "../contracts/core";

export const ConvertFigmaNodesInputSchema = z.object({
  nodes: z.array(z.any()),
  componentName: z.string().optional().default("FigmaScreen"),
});

export const ConvertFigmaNodesOutputSchema = z.object({
  code: z.string(),
});

export const FigmaFileNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  children: z.array(z.any()).optional(),
  absoluteBoundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export const FigmaDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal("DOCUMENT"),
  children: z.array(z.any()),
});

export const FigmaFileResponseSchema = z.object({
  name: z.string(),
  document: FigmaDocumentSchema,
});

export const FigmaImagesResponseSchema = z.object({
  err: z.string().optional(),
  images: z.record(z.string(), z.string().nullable()),
});

export const FigmaFileNodesResponseSchema = z.object({
  err: z.string().optional(),
  nodes: z.record(
    z.string(),
    z.object({
      document: z.any(),
      components: z.record(z.string(), z.any()).optional(),
    }),
  ),
});

export type FigmaFileResponse = z.infer<typeof FigmaFileResponseSchema>;
export type FigmaImagesResponse = z.infer<typeof FigmaImagesResponseSchema>;
export type FigmaFileNodesResponse = z.infer<typeof FigmaFileNodesResponseSchema>;

export const figmaContracts = {
  validateToken: defineContract({
    channel: "figma:validate-token",
    input: z.object({ token: z.string() }),
    output: z.object({ ok: z.boolean(), error: z.string().optional() }),
  }),

  getFile: defineContract({
    channel: "figma:get-file",
    input: z.object({
      fileKey: z.string(),
      token: z.string(),
      depth: z.number().optional().default(3),
    }),
    output: FigmaFileResponseSchema,
  }),

  getFileNodes: defineContract({
    channel: "figma:get-file-nodes",
    input: z.object({
      fileKey: z.string(),
      ids: z.string(),
      token: z.string(),
      depth: z.number().optional().default(2),
    }),
    output: FigmaFileNodesResponseSchema,
  }),

  getImageRenders: defineContract({
    channel: "figma:get-image-renders",
    input: z.object({
      fileKey: z.string(),
      ids: z.string(),
      token: z.string(),
      scale: z.number().optional().default(2),
      format: z.enum(["png", "svg"]).optional().default("png"),
    }),
    output: FigmaImagesResponseSchema,
  }),

  saveToken: defineContract({
    channel: "figma:save-token",
    input: z.object({ token: z.string() }),
    output: z.void(),
  }),

  getToken: defineContract({
    channel: "figma:get-token",
    input: z.void(),
    output: z.object({ token: z.string().nullable() }),
  }),

  convertNodes: defineContract({
    channel: "figma:convert-nodes",
    input: ConvertFigmaNodesInputSchema,
    output: ConvertFigmaNodesOutputSchema,
  }),
} as const;

export const figmaClient = createClient(figmaContracts);
