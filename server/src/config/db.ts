import mysql2, { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import dotenv from "dotenv";
import { CountResult } from "../types/dbTypes/countResult";
import { AppError } from "./exceptions";
import { HttpStatusCode } from "../constants/constants";
dotenv.config();

const isTestEnv = process.env.NODE_ENV === "test";

// Validate required environment variables
const requiredEnvVars: string[] = [
  "MYSQLHOST",
  "MYSQLUSER",
  "MYSQLPASSWORD",
  "MYSQLDATABASE",
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    if (!isTestEnv) process.exit(1);
    throw new AppError(
      HttpStatusCode.SERVER_ERROR,
      `Missing required environment variable: ${varName}`
    );
  }
});

const pool: mysql2.Pool = mysql2.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  dateStrings: true,
  timezone: "Z",
});

/**
 * Tracks physical connections whose UTC session setup has completed successfully,
 * allowing later checkouts to reuse them without repeating SET SESSION time_zone.
 * mysql2 creates a new promise wrapper on each checkout, so membership uses the
 * underlying connection object. Weak references let discarded connections be
 * garbage-collected when the pool no longer holds them.
 */
const utcInitializedConnections = new WeakSet<mysql2.Connection>();

/**
 * Checks out a pooled connection and awaits UTC session setup before returning it.
 * Setup runs once per physical connection, before its first use. Reused connections
 * skip the SET statement; new or replacement connections initialize independently.
 * The pool holds each connection exclusively until its caller releases it.
 * Callers must preserve the session time zone and destroy connections they reset.
 *
 * @returns A UTC-configured connection that the caller must release in a finally block.
 * @throws The driver error if checkout or UTC setup fails. Failed setup destroys
 * the connection so it cannot return to the pool with an unknown time zone.
 */
export async function getConnection(): Promise<mysql2.PoolConnection> {
  const connection = await pool.getConnection();
  const physicalConnection = connection.connection;
  if (!utcInitializedConnections.has(physicalConnection)) {
    try {
      // Driver timezone controls Date parameters; MySQL needs its own session zone.
      await connection.query("SET SESSION time_zone = '+00:00'");
      utcInitializedConnections.add(physicalConnection);
    } catch (error) {
      connection.destroy();
      throw error;
    }
  }
  return connection;
}

/**
 * Runs an operation on one UTC-configured connection and always releases it.
 * This replaces pool.execute's automatic checkout/release so UTC setup can be
 * awaited first. It does not begin, commit or roll back a transaction; separate
 * helper calls use independent checkouts and retain MySQL's autocommit behavior.
 *
 * @param operation - Work that uses the supplied connection without releasing it.
 * @returns The operation's result.
 * @throws Any checkout, setup or operation error, after applicable cleanup.
 */
async function withConnection<T>(
  operation: (connection: mysql2.PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  try {
    return await operation(connection);
  } finally {
    connection.release();
  }
}

/**
 * Verifies connectivity and UTC setup at startup, releasing each successful checkout.
 * Retries failed attempts up to five times, with two seconds between attempts.
 *
 * @throws {AppError} A server error after all connection attempts fail.
 */
async function testConnection(): Promise<void> {
  let retries = 5;
  while (retries > 0) {
    try {
      const connection = await getConnection();
      console.log("Successfully connected to the database.");
      connection.release();
      break;
    } catch (error) {
      retries -= 1;
      console.error(
        `Database connection failed. Retries left: ${retries}. Error:`,
        error
      );
      if (retries === 0) {
        console.error("All retries failed.");
        // throw instead of exiting so test runner or caller can handle it
        throw new AppError(
          HttpStatusCode.SERVER_ERROR,
          "Database connection failed after retries"
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Ends the private pool and closes its connections during application shutdown.
 *
 * @throws Any driver error encountered while closing the pool.
 */
async function closePool(): Promise<void> {
  await pool.end();
}

/**
 * Registers a graceful shutdown handler for the database pool in non-test
 * environments.
 *
 * On SIGINT, the application closes any open database connections before
 * terminating the process to avoid leaving orphaned pool resources behind.
 */
if (!isTestEnv) {
  process.on("SIGINT", async () => {
    console.log("Shutting down gracefully...");
    try {
      await closePool();
      console.log("Database connection pool closed.");
    } catch (error) {
      console.error("Error closing the database connection pool:", error);
    }
    process.exit(0);
  });
}

/**
 * Runs an initial connectivity check against the database when the application
 * is not executing in the test environment.
 *
 * This fails fast during startup if the database cannot be reached or the
 * configured connection is invalid.
 */
if (!isTestEnv) {
  (async () => {
    await testConnection();
  })();
}

/**
 * Executes a parameterized SELECT on a UTC-configured connection.
 * The generic describes the expected row shape; it does not validate runtime data.
 *
 * @param sql - SELECT statement with placeholders for untrusted values.
 * @param params - Values bound to the statement's placeholders.
 * @returns All matching rows, or an empty array.
 * @throws Any connection, UTC setup or SQL execution error.
 */
export async function queryListAsync<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute<T[]>(sql, params);
    return rows ?? [];
  });
}

/**
 * Appends LIMIT 1 to a parameterized SELECT and returns its first row.
 * Supply SQL without an existing LIMIT or trailing statement terminator.
 * The generic describes the expected row shape; it does not validate runtime data.
 *
 * @param sql - SELECT statement to limit, with placeholders for untrusted values.
 * @param params - Values bound to the statement's placeholders.
 * @returns The first matching row, or null.
 * @throws Any connection, UTC setup or SQL execution error.
 */
export async function queryFirstAsync<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  let query = `${sql} LIMIT 1`;
  return withConnection(async (connection) => {
    const [rows] = await connection.execute<T[]>(query, params);
    return rows[0] ?? null;
  });
}

/**
 * Executes one parameterized INSERT on a UTC-configured connection.
 * This call is independent of other helpers; it does not group writes atomically.
 *
 * @param sql - INSERT statement with placeholders for untrusted values.
 * @param params - Values bound to the statement's placeholders.
 * @returns The driver's generated insert ID, or zero when none is supplied.
 * @throws Any connection, UTC setup or SQL execution error.
 */
export async function insertAsync(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  return withConnection(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(sql, params);
    return result.insertId ?? 0;
  });
}

/**
 * Executes one parameterized write and returns the driver's affected-row count.
 * The count follows MySQL/driver semantics; it does not always mean changed rows.
 *
 * @param sql - Write statement with placeholders for untrusted values.
 * @param params - Values bound to the statement's placeholders.
 * @returns The affected-row count reported by mysql2.
 * @throws Any connection, UTC setup or SQL execution error.
 */
export async function executeNonQueryAsync(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  return withConnection(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(sql, params);
    return result.affectedRows;
  });
}

/**
 * Executes a parameterized count query on a UTC-configured connection.
 * The query must return at least one row with a numeric column aliased as count.
 *
 * @param sql - Count SELECT, such as SELECT COUNT(*) AS count FROM ... .
 * @param params - Values bound to the statement's placeholders.
 * @returns The first row's count, as reported by the driver.
 * @throws Any connection, UTC setup or SQL error; a missing row also causes failure.
 */
export async function countAsync(sql: string, params?: unknown[]): Promise<number> {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute<CountResult[]>(sql, params);
    return rows[0].count;
  });
}

// Keep raw pool access private so callers cannot bypass UTC initialization.
export default { getConnection, end: closePool };
