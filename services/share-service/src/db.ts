import pg from "pg";
import { config } from "./config.js";
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
});
export interface ShareRow {
  id: string;
  public_token_hash: string;
  manage_token_hash: string;
  object_key: string;
  project_name: string;
  package_version: number;
  package_size: string;
  checksum: string;
  created_at: Date;
  expires_at: Date;
  download_count: number;
  max_downloads: number | null;
  status: "pending" | "active" | "revoked" | "expired";
}
export async function findShareByPublicTokenHash(
  hash: string,
): Promise<ShareRow | null> {
  const result = await pool.query<ShareRow>(
    "SELECT * FROM project_shares WHERE public_token_hash = $1",
    [hash],
  );
  return result.rows[0] ?? null;
}
export function publicMetadata(row: ShareRow) {
  return {
    projectName: row.project_name,
    packageVersion: row.package_version,
    packageSize: Number(row.package_size),
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    downloadCount: row.download_count,
    maxDownloads: row.max_downloads,
    status: row.status,
  };
}
