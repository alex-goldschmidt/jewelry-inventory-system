import { getRequiredEnv, JwtSecretEnv } from "../../src/config/env";
import { AppError } from "../../src/config/exceptions";
import { HttpStatusCode } from "../../src/constants/constants";

describe("getRequiredEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe.each(Object.values(JwtSecretEnv))("%s", (name) => {
    it("returns the configured secret without changing its contents", () => {
      process.env[name] = " secret with spaces ";
      expect(getRequiredEnv(name)).toBe(" secret with spaces ");
    });

    it.each([undefined, "", " \t\n"])("rejects missing or blank values: %p", (value) => {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }

      expect(() => getRequiredEnv(name)).toThrow(new AppError(
        HttpStatusCode.SERVER_ERROR,
        `Missing required environment variable: ${name}`
      ));
      expect(() => getRequiredEnv(name)).toThrow(AppError);
    });
  });
});
