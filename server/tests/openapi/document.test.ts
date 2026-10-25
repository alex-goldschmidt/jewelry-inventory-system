import { createOpenApiDocument } from "../../src/openapi/document";

describe("OpenAPI document", () => {
  it("publishes stable unique operation IDs for SDK generation", () => {
    const document = createOpenApiDocument();
    const operationIds = [
      document.paths["/api/users/register"]?.post?.operationId,
      document.paths["/api/users/signIn"]?.post?.operationId,
      document.paths["/api/users/refreshToken"]?.post?.operationId,
      document.paths["/api/users/logout"]?.post?.operationId,
      document.paths["/api/users/{userId}"]?.get?.operationId,
      document.paths["/api/users/me"]?.get?.operationId,
    ];
    expect(operationIds).toEqual([
      "registerUser", "signIn", "refreshAccessToken", "logout", "getUserById", "getCurrentUser",
    ]);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("requires credentials bodies and separates bearer and cookie authentication", () => {
    const { paths } = createOpenApiDocument();
    expect(paths["/api/users/register"]?.post?.requestBody).toMatchObject({ required: true });
    expect(paths["/api/users/signIn"]?.post?.requestBody).toMatchObject({ required: true });
    expect(paths["/api/users/register"]?.post?.security).toBeUndefined();
    expect(paths["/api/users/signIn"]?.post?.security).toBeUndefined();
    expect(paths["/api/users/{userId}"]?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/users/me"]?.get?.security).toEqual([{ bearerAuth: [] }]);
    expect(paths["/api/users/refreshToken"]?.post?.security).toEqual([{ refreshTokenCookie: [] }]);
    expect(paths["/api/users/logout"]?.post?.security).toEqual([{ refreshTokenCookie: [] }]);
  });

  it("generates existing auth routes and public user schema", () => {
    const document = createOpenApiDocument();

    expect(document.paths["/api/users/register"]?.post).toBeDefined();
    expect(document.paths["/api/users/signIn"]?.post).toBeDefined();
    expect(document.paths["/api/users/refreshToken"]?.post).toBeDefined();
    expect(document.paths["/api/users/logout"]?.post).toBeDefined();
    expect(document.paths["/api/users/{userId}"]?.get).toBeDefined();

    const userSchema = document.components?.schemas?.User;

    expect(userSchema).toEqual(
      expect.objectContaining({
        type: "object",
        properties: expect.objectContaining({
          userId: expect.any(Object),
          email: expect.any(Object),
        }),
      })
    );
    expect(JSON.stringify(userSchema)).not.toContain("password");
  });
});
