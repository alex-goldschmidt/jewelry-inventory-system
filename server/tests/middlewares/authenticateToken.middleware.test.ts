import { createRequest, createResponse } from "node-mocks-http";
import jwt from "jsonwebtoken";
import { authenticateToken } from "../../src/middlewares/authenticateToken.middleware";
import { AppError, ForbiddenError, UnauthorizedError } from "../../src/config/exceptions";
import { HttpStatusCode } from "../../src/constants/constants";

describe("authenticateToken", () => {
  const res = createResponse();
  const originalSecret = process.env.JWT_ACCESS_TOKEN_SECRET;

  beforeEach(() => {
    process.env.JWT_ACCESS_TOKEN_SECRET = "test-access-secret";
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalSecret === undefined) {
      delete process.env.JWT_ACCESS_TOKEN_SECRET;
    } else {
      process.env.JWT_ACCESS_TOKEN_SECRET = originalSecret;
    }
  });

  it("passes missing authorization headers to next as UnauthorizedError", () => {
    const req = createRequest({ headers: {} });
    const next = jest.fn();
    const verifySpy = jest.spyOn(jwt, "verify");

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("rejects malformed bearer headers without verifying", () => {
    const req = createRequest({
      headers: { authorization: "Basic token" },
    });
    const next = jest.fn();
    const verifySpy = jest.spyOn(jwt, "verify");

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(verifySpy).not.toHaveBeenCalled();
  });

  it("sets req.user for valid bearer tokens", () => {
    const req = createRequest({
      headers: { authorization: "Bearer accessToken" },
    });
    const next = jest.fn();
    const decoded = { sub: "7" };
    jest
      .spyOn(jwt, "verify")
      .mockImplementationOnce(() => decoded);

    authenticateToken(req, res, next);

    expect(req.user).toEqual(decoded);
    expect(next).toHaveBeenCalledWith();
  });

  it("passes invalid token errors to next as ForbiddenError", () => {
    const req = createRequest({
      headers: { authorization: "Bearer badToken" },
    });
    const next = jest.fn();
    jest
      .spyOn(jwt, "verify")
      .mockImplementationOnce(() => {
        throw new jwt.JsonWebTokenError("invalid");
      });

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it.each([
    "text payload", {}, { sub: 7 }, { sub: "7junk" }, { sub: "0" },
    { sub: "-7" }, { sub: "1.5" }, { sub: "9007199254740992" },
  ])("rejects signed tokens with invalid identity claims: %p", (payload) => {
    const token = jwt.sign(payload, "test-access-secret", { algorithm: "HS256" });
    const req = createRequest({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("accepts a real HS256 token with a positive integer subject", () => {
    const token = jwt.sign({ sub: "7" }, "test-access-secret", { expiresIn: "15m" });
    const req = createRequest({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user?.sub).toBe("7");
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects tokens signed with an unexpected algorithm", () => {
    const token = jwt.sign({ sub: "7" }, "test-access-secret", { algorithm: "HS384" });
    const req = createRequest({ headers: { authorization: `Bearer ${token}` } });
    const next = jest.fn();

    authenticateToken(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it("forwards missing secrets as configuration errors", () => {
    delete process.env.JWT_ACCESS_TOKEN_SECRET;
    const req = createRequest({ headers: { authorization: "Bearer token" } });
    const next = jest.fn();
    const verifySpy = jest.spyOn(jwt, "verify");

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledWith(
      new AppError(
        HttpStatusCode.SERVER_ERROR,
        "Missing required environment variable: JWT_ACCESS_TOKEN_SECRET"
      )
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatusCode.SERVER_ERROR,
    }));
    expect(verifySpy).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});
