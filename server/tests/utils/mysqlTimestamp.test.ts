import { parseMysqlUtcTimestamp } from "../../src/utils/mysqlTimestamp";
import { AppError } from "../../src/config/exceptions";
import { HttpStatusCode } from "../../src/constants/constants";

describe("parseMysqlUtcTimestamp", () => {
  it.each([
    ["2026-10-25 12:00:00", "2026-10-25T12:00:00.000Z"],
    ["2024-02-29 23:59:59", "2024-02-29T23:59:59.000Z"],
    ["2026-03-08 02:30:00", "2026-03-08T02:30:00.000Z"],
    ["2026-11-01 01:30:00", "2026-11-01T01:30:00.000Z"],
  ])("reads %s as UTC regardless of the process time zone", (value, expected) => {
    expect(parseMysqlUtcTimestamp(value).toISOString()).toBe(expected);
  });

  it.each([
    null, undefined, 0, new Date(), "", "not-a-date",
    "0000-00-00 00:00:00", "0000-01-01 00:00:00",
    "2026-02-29 12:00:00", "2024-02-30 12:00:00",
    "2026-04-31 12:00:00", "2026-13-01 12:00:00",
    "2026-10-25 24:00:00", "2026-10-25 12:60:00",
    "2026-10-25 12:00:60", "2026-10-25T12:00:00Z",
    "2026-10-25 12:00:00.123", "2026-10-25 12:00:00 ",
  ])("rejects invalid or unexpected database timestamps: %p", (value) => {
    expect(() => parseMysqlUtcTimestamp(value))
      .toThrow(AppError);
    expect(() => parseMysqlUtcTimestamp(value))
      .toThrow(expect.objectContaining({
        statusCode: HttpStatusCode.SERVER_ERROR,
        message: "Invalid MySQL UTC timestamp",
      }));
  });
});
