import type { dto } from '@quad/core';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

function isCoordinate(value: unknown): boolean {
  return isRecord(value) && isNonNegativeInteger(value['x']) && isNonNegativeInteger(value['y']);
}

function isPublicIdentity(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['handle'] === 'string' &&
    (value['displayName'] === undefined || typeof value['displayName'] === 'string')
  );
}

function isProfileStats(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value['pixelsPlaced']) &&
    isNonNegativeInteger(value['survivingPixels']) &&
    isNonNegativeInteger(value['streakDays']) &&
    isNonNegativeInteger(value['longestStreakDays']) &&
    isNonNegativeInteger(value['canvasesParticipated']) &&
    (value['favoriteColor'] === undefined || isNonNegativeInteger(value['favoriteColor']))
  );
}

function isProfileRecentPlacement(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['term'] === 'string' &&
    isCoordinate(value['at']) &&
    isNonNegativeInteger(value['color']) &&
    typeof value['placedAt'] === 'string' &&
    typeof value['surviving'] === 'boolean'
  );
}

export function isCanvasMetaResponse(value: unknown): value is dto.CanvasMetaResponse {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['term'] === 'string' &&
    typeof value['status'] === 'string' &&
    isInteger(value['width']) &&
    value['width'] > 0 &&
    isInteger(value['height']) &&
    value['height'] > 0 &&
    typeof value['palette'] === 'string' &&
    value['palette'].length > 0
  );
}

export function isCanvasSnapshotResponse(value: unknown): value is dto.CanvasSnapshotResponse {
  if (
    !isRecord(value) ||
    !isInteger(value['width']) ||
    value['width'] <= 0 ||
    !isInteger(value['height']) ||
    value['height'] <= 0 ||
    !isNonNegativeInteger(value['seq']) ||
    !Array.isArray(value['cells'])
  ) {
    return false;
  }
  const width = value['width'];
  const height = value['height'];
  return value['cells'].every(
    (cell) =>
      isRecord(cell) &&
      isNonNegativeInteger(cell['x']) &&
      cell['x'] < width &&
      isNonNegativeInteger(cell['y']) &&
      cell['y'] < height &&
      isNonNegativeInteger(cell['color']),
  );
}

export function isPlacePixelResultResponse(value: unknown): value is dto.PlacePixelResultResponse {
  return (
    isRecord(value) &&
    isCoordinate(value['at']) &&
    isNonNegativeInteger(value['color']) &&
    isNonNegativeInteger(value['seq']) &&
    typeof value['placedAt'] === 'string' &&
    typeof value['cooldownMs'] === 'number' &&
    Number.isFinite(value['cooldownMs']) &&
    value['cooldownMs'] >= 0
  );
}

export function isPixelResponse(value: unknown): value is dto.PixelResponse {
  return (
    isRecord(value) &&
    isCoordinate(value['at']) &&
    isNonNegativeInteger(value['color']) &&
    (value['owner'] === undefined || isPublicIdentity(value['owner'])) &&
    (value['placedAt'] === undefined || typeof value['placedAt'] === 'string')
  );
}

export function isReplayMetaResponse(value: unknown): value is dto.ReplayMetaResponse {
  return (
    isRecord(value) &&
    typeof value['term'] === 'string' &&
    isNonNegativeInteger(value['eventCount']) &&
    isNonNegativeInteger(value['fromSeq']) &&
    isNonNegativeInteger(value['toSeq']) &&
    typeof value['available'] === 'boolean'
  );
}

export function isArchiveStatsResponse(value: unknown): value is dto.ArchiveStatsResponse {
  return (
    isRecord(value) &&
    typeof value['term'] === 'string' &&
    isNonNegativeInteger(value['totalPlacements']) &&
    isNonNegativeInteger(value['participants']) &&
    Array.isArray(value['topPlacers']) &&
    value['topPlacers'].every(
      (entry) =>
        isRecord(entry) &&
        typeof entry['handle'] === 'string' &&
        (entry['displayName'] === undefined || typeof entry['displayName'] === 'string') &&
        isNonNegativeInteger(entry['pixelsPlaced']),
    )
  );
}

export function isSessionResponse(value: unknown): value is dto.SessionResponse {
  return (
    isRecord(value) &&
    typeof value['authenticated'] === 'boolean' &&
    (value['user'] === undefined || isPublicIdentity(value['user'])) &&
    (value['role'] === undefined || typeof value['role'] === 'string')
  );
}

export function isProfileResponse(value: unknown): value is dto.ProfileResponse {
  return (
    isRecord(value) &&
    typeof value['handle'] === 'string' &&
    (value['displayName'] === undefined || typeof value['displayName'] === 'string') &&
    typeof value['role'] === 'string' &&
    typeof value['joinedAt'] === 'string' &&
    isNonNegativeInteger(value['pixelsPlaced']) &&
    isNonNegativeInteger(value['currentTermPixelsPlaced']) &&
    Array.isArray(value['contributions']) &&
    value['contributions'].every(
      (entry) => isRecord(entry) && typeof entry['date'] === 'string' && isNonNegativeInteger(entry['count']),
    ) &&
    isProfileStats(value['lifetimeStats']) &&
    isProfileStats(value['currentTermStats']) &&
    Array.isArray(value['recentPlacements']) &&
    value['recentPlacements'].every(isProfileRecentPlacement)
  );
}

export function isLeaderboardResponse(value: unknown): value is dto.LeaderboardResponse {
  return (
    isRecord(value) &&
    typeof value['category'] === 'string' &&
    typeof value['window'] === 'string' &&
    Array.isArray(value['entries']) &&
    value['entries'].every(
      (entry) =>
        isRecord(entry) &&
        isNonNegativeInteger(entry['rank']) &&
        typeof entry['handle'] === 'string' &&
        (entry['displayName'] === undefined || typeof entry['displayName'] === 'string') &&
        isNonNegativeInteger(entry['score']) &&
        isNonNegativeInteger(entry['pixelsPlaced']) &&
        isNonNegativeInteger(entry['survivingPixels']),
    )
  );
}
