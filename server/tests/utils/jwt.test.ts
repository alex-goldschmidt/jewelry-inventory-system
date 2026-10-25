import jwt from "jsonwebtoken";
import { generateTokenPair, verifyRefreshToken } from "../../src/utils/jwt";
import { AppError, ForbiddenError } from "../../src/config/exceptions";
import { JwtSecretEnv } from "../../src/config/env";
import { HttpStatusCode } from "../../src/constants/constants";

describe("jwt utils", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_ACCESS_TOKEN_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_TOKEN_SECRET = "test-refresh-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("generates unique refresh tokens for back-to-back issuances", async () => {
    const first = await generateTokenPair(42);
    const second = await generateTokenPair(42);

    expect(first.refreshToken).not.toEqual(second.refreshToken);

    const firstPayload = await verifyRefreshToken(first.refreshToken);
    const secondPayload = await verifyRefreshToken(second.refreshToken);

    expect(firstPayload).toMatchObject({ sub: "42" });
    expect(secondPayload).toMatchObject({ sub: "42" });
    expect(firstPayload).toHaveProperty("jti");
    expect(secondPayload).toHaveProperty("jti");
    expect(firstPayload.jti).not.toEqual(secondPayload.jti);
  });

  it.each(["text payload", {}, { sub: 42 }, { sub: "42junk" }, { sub: "0" }])(
    "rejects signed refresh tokens with invalid identity claims: %p", async (payload) => {
      const token = jwt.sign(payload, "test-refresh-secret");
      await expect(verifyRefreshToken(token)).rejects.toBeInstanceOf(ForbiddenError);
    }
  );

  it("rejects expired refresh tokens", async () => {
    const token = jwt.sign({ sub: "42" }, "test-refresh-secret", { expiresIn: -1 });
    await expect(verifyRefreshToken(token)).rejects.toThrow("Token expired");
  });

  it("rejects unexpected refresh algorithms", async () => {
    const token = jwt.sign({ sub: "42" }, "test-refresh-secret", { algorithm: "HS384" });
    await expect(verifyRefreshToken(token)).rejects.toThrow("Invalid token");
  });

  it.each(Object.values(JwtSecretEnv))(
    "fails clearly when signing without %s", async (name) => {
      delete process.env[name];
      await expect(generateTokenPair(42)).rejects.toMatchObject({
        constructor: AppError,
        statusCode: HttpStatusCode.SERVER_ERROR,
        message: `Missing required environment variable: ${name}`,
      });
    }
  );

  it("keeps missing refresh secrets as configuration errors", async () => {
    delete process.env.JWT_REFRESH_TOKEN_SECRET;
    await expect(verifyRefreshToken("token")).rejects.toMatchObject({
      constructor: AppError,
      statusCode: HttpStatusCode.SERVER_ERROR,
      message: "Missing required environment variable: JWT_REFRESH_TOKEN_SECRET",
    });
  });
});
