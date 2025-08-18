// src/utils/streaming-pagination.ts
/**
 * Efficient streaming pagination utilities that avoid loading all data into memory
 */

// Unicode-safe cursor encoding/decoding utilities using URL-safe base64
function toBase64(input: string): string {
  // Use TextEncoder for proper Unicode handling
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  
  // Convert to base64 using web-safe method
  if (typeof btoa === 'function') {
    // Convert bytes to binary string
    const binary = String.fromCharCode(...bytes);
    // Use URL-safe base64 (replace +/= with -_)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  
  // Fallback to Buffer if available (Node.js/Workers environment)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: any = (globalThis as any).Buffer;
  if (B?.from) {
    return B.from(bytes).toString('base64url');
  }
  
  throw new Error('Base64 encoding not supported in this environment');
}

function fromBase64(b64: string): string {
  // Add padding if needed for URL-safe base64
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (padded.length % 4)) % 4;
  const fullB64 = padded + '='.repeat(padding);
  
  if (typeof atob === 'function') {
    // Decode base64 to binary string
    const binary = atob(fullB64);
    // Convert binary string to bytes
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // Use TextDecoder for proper Unicode handling
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }
  
  // Fallback to Buffer if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: any = (globalThis as any).Buffer;
  if (B?.from) {
    return B.from(fullB64, 'base64').toString('utf-8');
  }
  
  throw new Error('Base64 decoding not supported in this environment');
}

const encodeCursor = (o: any) => toBase64(JSON.stringify(o));

const decodeCursor = (c?: string) => {
  if (c === undefined) return {};
  if (typeof c !== "string" || c.trim().length === 0) {
    throw new Error("Invalid cursor: empty");
  }
  try {
    const decoded = fromBase64(c);
    return JSON.parse(decoded);
  } catch {
    throw new Error("Invalid cursor: malformed");
  }
};

export interface PaginationOptions {
  pageSize: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  totalCount?: number;
}

/**
 * Paginate an array without loading all items into memory
 * This is a temporary solution - ideally Azure Search should support server-side pagination
 */
export function paginateArray<T>(
  items: T[],
  options: PaginationOptions
): PaginatedResponse<T> {
  const { pageSize, cursor } = options;
  const { offset = 0 } = decodeCursor(cursor);

  // Validate offset bounds
  if (offset < 0) {
    throw new Error("Invalid cursor: negative offset");
  }

  if (offset >= items.length) {
    // Return empty result if offset is beyond array bounds
    return {
      items: [],
      totalCount: items.length
    };
  }

  // Calculate slice boundaries
  const endIndex = Math.min(offset + pageSize, items.length);
  const slice = items.slice(offset, endIndex);
  const hasMore = endIndex < items.length;

  const result: PaginatedResponse<T> = {
    items: slice,
    totalCount: items.length
  };

  if (hasMore) {
    result.nextCursor = encodeCursor({ offset: endIndex });
  }

  return result;
}

/**
 * Stream-friendly pagination for large datasets
 * @param fetchFn Function that fetches data with skip/top parameters
 * @param options Pagination options
 */
export async function streamPaginate<T>(
  fetchFn: (skip: number, top: number) => Promise<{ value: T[]; count?: number }>,
  options: PaginationOptions
): Promise<PaginatedResponse<T>> {
  const { pageSize, cursor } = options;
  const { offset = 0 } = decodeCursor(cursor);

  // Validate offset
  if (offset < 0) {
    throw new Error("Invalid cursor: negative offset");
  }

  // Fetch only the required page
  const result = await fetchFn(offset, pageSize);
  
  // Fix: Use count when available for accurate hasMore calculation
  const hasMore = result.count !== undefined 
    ? (offset + result.value.length) < result.count
    : result.value.length === pageSize;

  const response: PaginatedResponse<T> = {
    items: result.value,
    totalCount: result.count
  };

  if (hasMore) {
    response.nextCursor = encodeCursor({ offset: offset + result.value.length });
  }

  return response;
}
