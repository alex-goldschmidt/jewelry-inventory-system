import { dbRow } from "../helpers/dbRow";

const mockQuery = jest.fn<Promise<unknown>, [string]>();
const mockExecute = jest.fn<Promise<unknown>, [string, unknown[]?]>();
const mockConnection = {
  connection: {},
  query: mockQuery,
  execute: mockExecute,
  release: jest.fn(),
  destroy: jest.fn(),
};
const mockPool = {
  getConnection: jest.fn(async () => mockConnection),
  end: jest.fn(async () => {}),
};
const mockCreatePool = jest.fn();

jest.mock("mysql2/promise", () => ({
  __esModule: true,
  default: {
    createPool: (options: unknown) => {
      mockCreatePool(options);
      return mockPool;
    },
  },
}));

describe("database UTC connections", () => {
  let database: typeof import("../../src/config/db");

  beforeAll(async () => {
    database = await import("../../src/config/db");
  });

  beforeEach(() => {
    mockConnection.connection = {};
    mockQuery.mockReset().mockResolvedValue(undefined);
    mockExecute.mockReset().mockResolvedValue([[], []]);
    mockPool.getConnection.mockReset().mockResolvedValue(mockConnection);
    mockConnection.release.mockClear();
    mockConnection.destroy.mockClear();
  });

  it("preserves date strings and serializes Date parameters in UTC", () => {
    expect(mockCreatePool).toHaveBeenCalledWith(expect.objectContaining({
      dateStrings: true,
      timezone: "Z",
    }));
  });

  it("waits for the UTC session setting before executing a query", async () => {
    const initialization = Promise.withResolvers<void>();
    mockQuery.mockReturnValueOnce(initialization.promise);
    mockExecute.mockResolvedValueOnce([[dbRow({ value: 7 })], []]);

    const result = database.queryListAsync("SELECT ? AS value", [7]);
    await Promise.resolve();
    expect(mockQuery).toHaveBeenCalledWith("SET SESSION time_zone = '+00:00'");
    expect(mockExecute).not.toHaveBeenCalled();

    initialization.resolve();
    await expect(result).resolves.toEqual([expect.objectContaining({ value: 7 })]);
    expect(mockExecute).toHaveBeenCalledWith("SELECT ? AS value", [7]);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
  });

  it("destroys an uninitialized connection and propagates failure without executing SQL", async () => {
    const error = new Error("Session configuration failed");
    mockQuery.mockRejectedValueOnce(error);

    await expect(database.queryListAsync("SELECT 1")).rejects.toBe(error);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockConnection.destroy).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).not.toHaveBeenCalled();
  });

  it("releases the connection when an application query fails", async () => {
    const error = new Error("Query failed");
    mockExecute.mockRejectedValueOnce(error);

    await expect(database.queryListAsync("SELECT 1")).rejects.toBe(error);
    expect(mockConnection.release).toHaveBeenCalledTimes(1);
    expect(mockConnection.destroy).not.toHaveBeenCalled();
  });

  it("initializes a physical connection once across different promise wrappers", async () => {
    const secondWrapper = { ...mockConnection };
    mockPool.getConnection
      .mockResolvedValueOnce(mockConnection)
      .mockResolvedValueOnce(secondWrapper);

    const first = await database.default.getConnection();
    first.release();
    const second = await database.getConnection();
    second.release();

    expect(mockPool.getConnection).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
    expect(first.connection).toBe(second.connection);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(2);
  });

  it("awaits initialization separately for each new physical connection", async () => {
    const newConnection = { ...mockConnection, connection: {} };
    mockPool.getConnection
      .mockResolvedValueOnce(mockConnection)
      .mockResolvedValueOnce(newConnection);

    const first = await database.getConnection();
    first.release();
    const initialization = Promise.withResolvers<void>();
    mockQuery.mockReturnValueOnce(initialization.promise);

    const result = database.queryListAsync("SELECT 1");
    await Promise.resolve();
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockExecute).not.toHaveBeenCalled();

    initialization.resolve();
    await result;
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(2);
  });

  it("initializes a replacement after setup failure discards the first connection", async () => {
    const replacement = {
      ...mockConnection,
      connection: {},
      release: jest.fn(),
      destroy: jest.fn(),
    };
    mockPool.getConnection
      .mockResolvedValueOnce(mockConnection)
      .mockResolvedValueOnce(replacement);
    const error = new Error("Session configuration failed");
    mockQuery.mockRejectedValueOnce(error);

    await expect(database.queryListAsync("SELECT 1")).rejects.toBe(error);
    expect(mockExecute).not.toHaveBeenCalled();
    expect(mockConnection.destroy).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).not.toHaveBeenCalled();

    await expect(database.queryListAsync("SELECT 1")).resolves.toEqual([]);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(replacement.release).toHaveBeenCalledTimes(1);
    expect(replacement.destroy).not.toHaveBeenCalled();
  });

  it("preserves read and write helper results and releases each connection", async () => {
    mockExecute
      .mockResolvedValueOnce([[dbRow({ value: 7 })], []])
      .mockResolvedValueOnce([{ insertId: 42 }, []])
      .mockResolvedValueOnce([{ affectedRows: 1 }, []])
      .mockResolvedValueOnce([[dbRow({ count: 3 })], []]);

    await expect(database.queryFirstAsync("SELECT ? AS value", [7]))
      .resolves.toEqual(expect.objectContaining({ value: 7 }));
    await expect(database.insertAsync("INSERT INTO example (value) VALUES (?)", [7]))
      .resolves.toBe(42);
    await expect(database.executeNonQueryAsync("DELETE FROM example WHERE value = ?", [7]))
      .resolves.toBe(1);
    await expect(database.countAsync("SELECT COUNT(*) AS count FROM example"))
      .resolves.toBe(3);
    expect(mockExecute).toHaveBeenNthCalledWith(1, "SELECT ? AS value LIMIT 1", [7]);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockConnection.release).toHaveBeenCalledTimes(4);
  });
});
