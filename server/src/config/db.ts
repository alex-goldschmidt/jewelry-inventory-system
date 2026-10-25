import mysql2, { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import dotenv from "dotenv";
import { CountResult } from "../types/dbTypes/countResult";
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
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});

const pool: mysql2.Pool = mysql2.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  dateStrings: true,
});

async function testConnection(): Promise<void> {
  let retries = 5;
  while (retries > 0) {
    try {
      const connection = await pool.getConnection();
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
        throw new Error("Database connection failed after retries");
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// Graceful shutdown — only register in non-test env
if (!isTestEnv) {
  process.on("SIGINT", async () => {
    console.log("Shutting down gracefully...");
    try {
      await pool.end();
      console.log("Database connection pool closed.");
    } catch (error) {
      console.error("Error closing the database connection pool:", error);
    }
    process.exit(0);
  });
}

// Run initial connection check only when not testing
if (!isTestEnv) {
  (async () => {
    await testConnection();
  })();
}

export async function queryListAsync<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.execute<T[]>(sql, params);
  return rows ?? [];
}

export async function queryFirstAsync<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  let query = `${sql} LIMIT 1`;
  const [rows] = await pool.execute<T[]>(query, params);
  return rows[0] ?? null;
}

export async function insertAsync(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result.insertId ?? 0;
}

export async function executeNonQueryAsync(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result.affectedRows;
}

export async function countAsync(sql: string, params?: unknown[]): Promise<number> {
  const [rows] = await pool.execute<CountResult[]>(sql, params);
  return rows[0].count;
}

export default pool;
