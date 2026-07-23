const SECRET_FILE =
  /(^|\/)(?:\.env(?:\..+)?|\.npmrc|\.yarnrc|\.pypirc|\.netrc|auth\.json|.*credentials?.*|.*secrets?.*|.*service-account.*|id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|p12|pfx|key|keystore|jks))$/i;
const SAFE_ENV_EXAMPLE = /(^|\/)\.env\.(?:example|sample|template)$/i;

export function isSafePublicPreviewPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return SAFE_ENV_EXAMPLE.test(normalized) || !SECRET_FILE.test(normalized);
}
