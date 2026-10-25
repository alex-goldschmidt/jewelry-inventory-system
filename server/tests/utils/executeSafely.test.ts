import { createResponse } from "../helpers/http";
import executeSafely, { ExecutorOptions } from "../../src/utils/executeSafely";

describe("executeSafely", () => {
  let mockRes: ReturnType<typeof createResponse>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRes = createResponse();
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("successful responses", () => {
    it("should send data with default 200 status", async () => {
      const data = { id: 1, name: "Test Item" };
      const fn = jest.fn().mockResolvedValueOnce(data);

      await executeSafely(fn, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(data);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should send data with custom success status", async () => {
      const data = { id: 42 };
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions = { successStatus: 201 };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(data);
    });

    it("should send array with 200 status", async () => {
      const data = [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ];
      const fn = jest.fn().mockResolvedValueOnce(data);

      await executeSafely(fn, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(data);
    });

    it("should set content type if provided", async () => {
      const data = { id: 1 };
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions = { contentType: "application/json" };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.type).toHaveBeenCalledWith("application/json");
      expect(mockRes.json).toHaveBeenCalledWith(data);
    });
  });

  describe("empty value handling", () => {
    it("should handle null with onEmpty config", async () => {
      const fn = jest.fn().mockResolvedValueOnce(null);
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "Not found" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Not found" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should handle undefined with onEmpty config", async () => {
      const fn = jest.fn().mockResolvedValueOnce(undefined);
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "Item not found" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Item not found",
      });
    });

    it("should handle empty array with onEmpty config", async () => {
      const fn = jest.fn().mockResolvedValueOnce([]);
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "No items found" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "No items found",
      });
    });

    it("should use default message if onEmpty message not provided", async () => {
      const fn = jest.fn().mockResolvedValueOnce(null);
      const opts: ExecutorOptions = { onEmpty: { status: 404 } };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.json).toHaveBeenCalledWith({ message: "Not found" });
    });

    it("should not treat empty as empty if onEmpty is null", async () => {
      const fn = jest.fn().mockResolvedValueOnce(null);
      const opts: ExecutorOptions = { onEmpty: null };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(null);
    });

    it("should not call onEmpty for non-empty array", async () => {
      const data = [{ id: 1 }];
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "Empty" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(data);
    });
  });

  describe("transform function", () => {
    it("should apply transform to reshape object", async () => {
      const data = { id: 1, name: "Test", secret: "hidden", internal: "field" };
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions<typeof data> = {
        transform: (d) => ({ id: d.id, name: d.name }),
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.json).toHaveBeenCalledWith({ id: 1, name: "Test" });
    });

    it("should apply transform to return primitive", async () => {
      const data = { id: 42, name: "Test" };
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions<typeof data> = {
        transform: (d) => d.id,
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.json).toHaveBeenCalledWith(42);
    });

    it("should not apply transform if not provided", async () => {
      const data = { id: 1, name: "Test" };
      const fn = jest.fn().mockResolvedValueOnce(data);

      await executeSafely(fn, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(data);
    });

    it("should apply transform with custom status", async () => {
      const data = { id: 99, name: "Created" };
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions<typeof data> = {
        successStatus: 201,
        transform: (d) => ({ id: d.id }),
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ id: 99 });
    });
  });

  describe("error handling", () => {
    it("should forward errors to next middleware", async () => {
      const error = new Error("Service failed");
      const fn = jest.fn().mockRejectedValueOnce(error);

      await executeSafely(fn, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should forward any error type", async () => {
      const error = { code: 500, message: "Internal error" };
      const fn = jest.fn().mockRejectedValueOnce(error);

      await executeSafely(fn, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("edge cases", () => {
    it("should treat 0 as valid non-empty value", async () => {
      const fn = jest.fn().mockResolvedValueOnce(0);
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "Empty" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(0);
    });

    it("should treat false as valid non-empty value", async () => {
      const fn = jest.fn().mockResolvedValueOnce(false);
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "Empty" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(false);
    });

    it("should treat empty string as valid non-empty value", async () => {
      const fn = jest.fn().mockResolvedValueOnce("");
      const opts: ExecutorOptions = {
        onEmpty: { status: 404, message: "Empty" },
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith("");
    });

    it("should call fn with no arguments", async () => {
      const fn = jest.fn().mockResolvedValueOnce({ id: 1 });

      await executeSafely(fn, mockRes, mockNext);

      expect(fn).toHaveBeenCalledWith();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle all options together", async () => {
      const data = { id: 5, name: "Combined", secret: "x" };
      const fn = jest.fn().mockResolvedValueOnce(data);
      const opts: ExecutorOptions<typeof data> = {
        successStatus: 201,
        contentType: "application/json",
        transform: (d) => ({ id: d.id, name: d.name }),
      };

      await executeSafely(fn, mockRes, mockNext, opts);

      expect(mockRes.type).toHaveBeenCalledWith("application/json");
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ id: 5, name: "Combined" });
    });
  });
});
