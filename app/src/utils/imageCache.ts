/**
 * Image cache using localStorage for instant dithering regeneration
 */

const CACHE_PREFIX = 'escpos-image-cache-';
const MAX_CACHE_SIZE_MB = 10; // Limit cache to 10MB
const MAX_CACHE_SIZE_BYTES = MAX_CACHE_SIZE_MB * 1024 * 1024;

export interface CachedImage {
  base64: string; // Original PNG in base64
  width: number;
  height: number;
  timestamp: number;
}

/**
 * Generate cache key from image match ID
 */
function getCacheKey(imageId: string): string {
  return `${CACHE_PREFIX}${imageId}`;
}

/**
 * Store original image in localStorage
 */
export function cacheOriginalImage(
  imageId: string,
  base64: string,
  width: number,
  height: number
): boolean {
  try {
    const cached: CachedImage = {
      base64,
      width,
      height,
      timestamp: Date.now(),
    };

    const cacheKey = getCacheKey(imageId);
    const serialized = JSON.stringify(cached);

    // Check size before storing
    if (serialized.length > MAX_CACHE_SIZE_BYTES / 2) {
      console.warn('[ImageCache] Image too large to cache:', serialized.length, 'bytes');
      return false;
    }

    localStorage.setItem(cacheKey, serialized);
    return true;
  } catch (err) {
    console.error('[ImageCache] Failed to cache image:', err);
    // If quota exceeded, try to clear old entries
    clearOldCacheEntries();
    return false;
  }
}

/**
 * Retrieve original image from cache
 */
export function getCachedImage(imageId: string): CachedImage | null {
  try {
    const cacheKey = getCacheKey(imageId);
    const serialized = localStorage.getItem(cacheKey);

    if (!serialized) {
      return null;
    }

    const cached: CachedImage = JSON.parse(serialized);
    return cached;
  } catch (err) {
    console.error('[ImageCache] Failed to retrieve cached image:', err);
    return null;
  }
}

/**
 * Check if an image is cached
 */
export function hasCachedImage(imageId: string): boolean {
  const cacheKey = getCacheKey(imageId);
  return localStorage.getItem(cacheKey) !== null;
}

/**
 * Remove image from cache
 */
export function removeCachedImage(imageId: string): void {
  const cacheKey = getCacheKey(imageId);
  localStorage.removeItem(cacheKey);
}

/**
 * Clear old cache entries (oldest first) to free up space
 */
export function clearOldCacheEntries(): void {
  try {
    const entries: Array<{ key: string; timestamp: number }> = [];

    // Find all cache entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const cached: CachedImage = JSON.parse(value);
            entries.push({ key, timestamp: cached.timestamp });
          }
        } catch {
          // Invalid entry, remove it
          localStorage.removeItem(key);
        }
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
    }

    console.log(`[ImageCache] Cleared ${toRemove} old entries`);
  } catch (err) {
    console.error('[ImageCache] Failed to clear old entries:', err);
  }
}

/**
 * Clear all cached images
 */
export function clearAllCachedImages(): void {
  const keys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.getItem(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keys.push(key);
    }
  }

  keys.forEach(key => localStorage.removeItem(key));
  console.log(`[ImageCache] Cleared ${keys.length} cached images`);
}

/**
 * Get total cache size in bytes
 */
export function getCacheSize(): number {
  let totalSize = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    }
  }

  return totalSize;
}
