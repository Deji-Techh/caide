let pendingProjectShareToken: string | null = null;

export function queuePendingProjectShareToken(token: string): void {
  if (pendingProjectShareToken === token) return;
  pendingProjectShareToken = token;
}

export function consumePendingProjectShareToken(): string | null {
  const token = pendingProjectShareToken;
  pendingProjectShareToken = null;
  return token;
}
