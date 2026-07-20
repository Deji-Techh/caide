const FREE_MODEL_QUOTA_LIMIT = 5;

export function useFreeModelQuota({
  enabled: _enabled = true,
}: { enabled?: boolean } = {}) {
  return {
    quotaStatus: undefined,
    isLoading: false,
    error: null,
    invalidateQuota: () => undefined,
    isQuotaExceeded: false,
    messagesUsed: 0,
    messagesLimit: FREE_MODEL_QUOTA_LIMIT,
    messagesRemaining: FREE_MODEL_QUOTA_LIMIT,
    resetTime: null,
  };
}
