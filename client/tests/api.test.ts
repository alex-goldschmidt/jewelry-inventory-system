import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { client } from "../src/api/client";
import { getCurrentUser, getUserById, registerUser, refreshAccessToken, logout } from "../src/api/generated/sdk.gen";
import { getCurrentUserOptions } from "../src/api/generated/@tanstack/react-query.gen";
import { setAccessToken } from "../src/auth/token";

const fetchMock = vi.fn<typeof fetch>();

function lastRequest(): Request {
  const request = fetchMock.mock.calls.at(-1)?.[0];
  if (!(request instanceof Request)) throw new Error("Expected a fetch Request");
  return request;
}

describe("generated SDK integration", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    setAccessToken(undefined);
    client.setConfig({ baseUrl: "https://api.example.test", fetch: fetchMock });
  });

  afterEach(() => setAccessToken(undefined));

  it("serializes registration input and includes credentials without a bearer token", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }, { status: 201 }));
    const body = { email: "me@example.com", password: "Password123" };
    const result = await registerUser({ body });
    const request = lastRequest();
    expect(request.url).toBe("https://api.example.test/api/users/register");
    expect(request.method).toBe("POST");
    expect(request.credentials).toBe("include");
    expect(request.headers.get("Authorization")).toBeNull();
    expect(request.headers.get("Content-Type")).toBe("application/json");
    const submitted: unknown = JSON.parse(await request.text());
    expect(submitted).toEqual(body);
    expect(result.data).toEqual({ success: true });
  });

  it("reads the latest in-memory token for protected requests and encodes route parameters", async () => {
    fetchMock.mockResolvedValue(Response.json({ userId: 7, email: "me@example.com" }));
    setAccessToken("first-token");
    await getCurrentUser();
    expect(lastRequest().headers.get("Authorization")).toBe("Bearer first-token");
    setAccessToken("rotated-token");
    await getUserById({ path: { userId: "7" } });
    expect(lastRequest().url).toBe("https://api.example.test/api/users/7");
    expect(lastRequest().headers.get("Authorization")).toBe("Bearer rotated-token");
  });

  it("leaves refresh and logout cookies to the browser instead of using the access token", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ accessToken: "new-token" }));
    fetchMock.mockResolvedValueOnce(Response.json({ success: true }));
    setAccessToken("access-token");
    await refreshAccessToken();
    expect(lastRequest().credentials).toBe("include");
    expect(lastRequest().headers.get("Authorization")).toBeNull();
    expect(lastRequest().headers.get("Cookie")).toBeNull();
    await logout();
    expect(lastRequest().url).toBe("https://api.example.test/api/users/logout");
    expect(lastRequest().credentials).toBe("include");
    expect(lastRequest().headers.get("Cookie")).toBeNull();
  });

  it("propagates backend error responses through generated TanStack query options", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ statusCode: 403, message: "Token expired" }, { status: 403 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(queryClient.fetchQuery(getCurrentUserOptions()))
      .rejects.toMatchObject({ statusCode: 403, message: "Token expired" });
    queryClient.clear();
  });
});
