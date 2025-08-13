// src/utils/timeout.ts
import { DEFAULT_TIMEOUT_MS } from "../constants";

export class TimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps an async operation with a timeout
 * @param promiseOrFn The async operation to wrap (Promise or function returning Promise)
 * @param timeoutMs Timeout in milliseconds
 * @param operation Operation name for error messages
 * @returns The result of the promise or throws TimeoutError
 */
export async function withTimeout<T>(
  promiseOrFn: Promise<T> | (() => Promise<T>),
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  operation: string = "operation"
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    // Fix #7: Support both Promise and function returning Promise
    const promise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Creates a timeout wrapper function for client methods
 * @param timeoutMs Default timeout in milliseconds
 * @returns A wrapper function that adds timeout to async operations
 */
export function createTimeoutWrapper(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return function<T>(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      return withTimeout(
        () => originalMethod.apply(this, args),
        timeoutMs,
        propertyKey
      );
    };
    
    return descriptor;
  };
}
