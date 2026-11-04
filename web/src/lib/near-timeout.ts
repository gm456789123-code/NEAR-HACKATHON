export class NearRpcTimeoutError extends Error {
  readonly operation: string;
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`NEAR RPC operation timed out after ${timeoutMs.toString()}ms`);
    this.name = "NearRpcTimeoutError";
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export async function withTimeout<T>(
  operationPromise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("Timeout must be a positive integer");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new NearRpcTimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
