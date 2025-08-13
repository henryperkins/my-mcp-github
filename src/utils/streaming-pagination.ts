// src/utils/streaming-pagination.ts
/**
 * Efficient streaming pagination utilities that avoid loading all data into memory
 */

import { encodeCursor, decodeCursor } from "./pagination";

export interface PaginationOptions {
  pageSize: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
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
      hasMore: false,
      totalCount: items.length
    };
  }
  
  // Calculate slice boundaries
  const endIndex = Math.min(offset + pageSize, items.length);
  const slice = items.slice(offset, endIndex);
  const hasMore = endIndex < items.length;
  
  const result: PaginatedResponse<T> = {
    items: slice,
    hasMore,
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
  const hasMore = result.value.length === pageSize;
  
  const response: PaginatedResponse<T> = {
    items: result.value,
    hasMore,
    totalCount: result.count
  };
  
  if (hasMore) {
    response.nextCursor = encodeCursor({ offset: offset + pageSize });
  }
  
  return response;
}