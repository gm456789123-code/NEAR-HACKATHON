import { timingSafeEqual } from "node:crypto";

const MINIMUM_ADMIN_TOKEN_LENGTH = 32;

export class AdminAuthError extends Error {
  readonly status: 401 | 503;

  constructor(status: 401 | 503, message: string) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

export function assertAdminAuthorization(
  authorizationHeader: string | null,
  configuredToken: string | undefined
): void {
  if (
    configuredToken === undefined ||
    configuredToken.length < MINIMUM_ADMIN_TOKEN_LENGTH
  ) {
    throw new AdminAuthError(
      503,
      "Administrative writes are disabled until TREASURY_ADMIN_TOKEN is configured"
    );
  }

  const prefix = "Bearer ";
  if (!authorizationHeader?.startsWith(prefix)) {
    throw new AdminAuthError(401, "Administrator authentication required");
  }

  const suppliedToken = authorizationHeader.slice(prefix.length);
  const suppliedBuffer = Buffer.from(suppliedToken, "utf8");
  const configuredBuffer = Buffer.from(configuredToken, "utf8");
  const matches =
    suppliedBuffer.length === configuredBuffer.length &&
    timingSafeEqual(suppliedBuffer, configuredBuffer);
  if (!matches) {
    throw new AdminAuthError(401, "Administrator authentication required");
  }
}

export function assertAdminRequest(request: Request): void {
  assertAdminAuthorization(
    request.headers.get("authorization"),
    process.env.TREASURY_ADMIN_TOKEN
  );
}
