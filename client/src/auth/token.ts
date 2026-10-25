let accessToken: string | undefined;

export function getAccessToken(): string | undefined {
  return accessToken;
}

/**
 * Keep bearer tokens in memory; the server owns the HTTP-only refresh cookie.
 */
export function setAccessToken(token: string | undefined): void {
  accessToken = token;
}
