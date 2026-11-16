export interface SnapshotListenMetadata {
  hasPendingWrites: boolean
  fromCache: boolean
}

/** Server snapshot only. Local pending writes and cached copies are ignored. */
export function isCommittedServerSnapshot(metadata: SnapshotListenMetadata): boolean {
  return !metadata.hasPendingWrites && !metadata.fromCache
}

export const PERMISSION_DENIED_BACKOFF_MS = [300, 800, 2_000, 4_000] as const

export function isPermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  return String((error as { code: unknown }).code).includes('permission-denied')
}

/**
 * Delay before another listen attempt after `failureCount` permission-denied
 * errors (0 is the first failure). Null means the error should be shown.
 */
export function nextPermissionRetryDelay(failureCount: number, error: unknown): number | null {
  if (!isPermissionDenied(error)) return null
  return PERMISSION_DENIED_BACKOFF_MS[failureCount] ?? null
}
