import { Request } from "express";
import { createRequest, createResponse } from "node-mocks-http";
import { authorizeUserId } from "../../src/middlewares/authorization.middleware";
import { ForbiddenError, UnauthorizedError } from "../../src/config/exceptions";

function requestFor(userId: string) {
  return createRequest<Request<{ userId: string }>>({
    params: { userId },
    user: { sub: "7" },
  });
}

describe("authorizeUserId", () => {
  it("allows the authenticated user's own ID", () => {
    const next = jest.fn();
    authorizeUserId(requestFor("7"), createResponse(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a different user", () => {
    expect(() => authorizeUserId(requestFor("8"), createResponse(), jest.fn()))
      .toThrow(ForbiddenError);
  });

  it("requires authentication", () => {
    const req = requestFor("7");
    delete req.user;
    expect(() => authorizeUserId(req, createResponse(), jest.fn()))
      .toThrow(UnauthorizedError);
  });

  it.each(["7junk", "7.5", "7e0", " 7", "0", "-7", "07", "9007199254740992"])(
    "rejects malformed or unsafe route IDs: %s", (userId) => {
      const next = jest.fn();
      expect(() => authorizeUserId(requestFor(userId), createResponse(), next))
        .toThrow(UnauthorizedError);
      expect(next).not.toHaveBeenCalled();
    }
  );
});
