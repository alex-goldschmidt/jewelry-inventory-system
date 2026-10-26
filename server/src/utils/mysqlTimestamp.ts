import { AppError } from "../config/exceptions";
import { HttpStatusCode } from "../constants/constants";

const MYSQL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const MYSQL_ZERO_YEAR_PREFIX = "0000-";
const MYSQL_DATE_TIME_SEPARATOR = " ";
const ISO_DATE_TIME_SEPARATOR = "T";
const ISO_UTC_SECOND_SUFFIX = ".000Z";
const INVALID_TIMESTAMP_MESSAGE = "Invalid MySQL UTC timestamp";

/**
 * Parses a second-precision MySQL TIMESTAMP string generated from a UTC session.
 *
 * @param value - A database value in YYYY-MM-DD HH:mm:ss format from a UTC session.
 * @returns The parsed UTC Date.
 * @throws {AppError} A server error for malformed or impossible database values.
 * This represents invalid stored data, rather than invalid client input.
 */
export function parseMysqlUtcTimestamp(value: unknown): Date {
  if (typeof value !== "string" || !MYSQL_TIMESTAMP_PATTERN.test(value)) {
    throw new AppError(HttpStatusCode.SERVER_ERROR, INVALID_TIMESTAMP_MESSAGE);
  }

  const isoTimestamp = value.replace(MYSQL_DATE_TIME_SEPARATOR, ISO_DATE_TIME_SEPARATOR)
    + ISO_UTC_SECOND_SUFFIX;
  const date = new Date(isoTimestamp);
  // Round-trip validation rejects calendar overflow such as February 30.
  if (
    value.startsWith(MYSQL_ZERO_YEAR_PREFIX) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== isoTimestamp
  ) {
    throw new AppError(HttpStatusCode.SERVER_ERROR, INVALID_TIMESTAMP_MESSAGE);
  }
  return date;
}
