const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
jest.mock("mysql2/promise", () => ({ createConnection: jest.fn() }));
const mysql = require("mysql2/promise");
const {
  parseArgs, ensureSafeName, mapMysqlTypeToTs, getColumnsFromDb,
  createFilesConfig, writeFileIfNeeded,
} = require("../../scripts/generate-resource");

describe("resource generator", () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["decimal", "string"], ["numeric", "string"], ["int", "number"],
    ["tinyint", "number"], ["bit", "Buffer"], ["varbinary", "Buffer"],
    ["timestamp", "string"], ["date", "string"], ["json", "unknown"],
    ["geometry", "unknown"],
  ])("maps %s to the mysql2 result type %s", (DATA_TYPE, expected) => {
    expect(mapMysqlTypeToTs({ DATA_TYPE })).toBe(expected);
  });

  it.each([
    ["thing", "--wat"], ["thing", "--table"], ["thing", "--table", "--dry-run"],
    ["thing", "extra"], ["thing", "--check", "--force"],
    ["thing", "--check", "--dry-run"],
  ])("rejects invalid arguments: %j", (...args) => {
    expect(() => parseArgs(args)).toThrow();
  });

  it("accepts read-only database drift checking", () => {
    expect(parseArgs(["thing", "--from-db", "--check"]))
      .toMatchObject({ resourceName: "thing", fromDb: true, check: true });
  });

  it.each(["../outside", "thing/file", "thing;DROP", "1thing"])("rejects unsafe names: %s", (name) => {
    expect(() => ensureSafeName(name, "Resource")).toThrow();
  });

  it("renders deterministic DTOs, quoting unusual columns and preserving nullability", () => {
    const columns = [
      { name: "id", tsType: "number", isNullable: false },
      { name: "display-name", tsType: "string", isNullable: true },
    ];
    const [file] = createFilesConfig("project-task", "task_table", columns, true);
    expect(file.path).toMatch(/projectTask\.dto\.ts$/);
    expect(file.content).toContain("export interface ProjectTaskDTO");
    expect(file.content).toContain('"display-name": string | null;');
    expect(file.content).toContain("--from-db --table task_table");
    expect(createFilesConfig("project-task", "task_table", columns, true)[0].content)
      .toBe(file.content);
  });

  it("checks and previews DTOs without writing files", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "resource-test-"));
    const file = path.join(directory, "thing.dto.ts");
    jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      writeFileIfNeeded(file, "expected", { dryRun: true });
      expect(fs.existsSync(file)).toBe(false);
      expect(() => writeFileIfNeeded(file, "expected", { check: true })).toThrow("out of date");
      fs.writeFileSync(file, "expected");
      expect(() => writeFileIfNeeded(file, "expected", { check: true })).not.toThrow();
      expect(() => writeFileIfNeeded(file, "changed", { check: true })).toThrow("out of date");
      expect(fs.readFileSync(file, "utf8")).toBe("expected");
      expect(() => writeFileIfNeeded(file, "changed", {})).toThrow("Refusing to overwrite");
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("closes introspection connections when a query fails", async () => {
    const end = jest.fn().mockResolvedValue(undefined);
    const error = new Error("DB unavailable");
    const execute = jest.fn().mockRejectedValue(error);
    jest.mocked(mysql.createConnection).mockResolvedValue({ execute, end });
    await expect(getColumnsFromDb("thing")).rejects.toBe(error);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("rejects layer scaffolding before connecting or creating files", () => {
    const result = spawnSync(process.execPath, [
      path.resolve(__dirname, "../../scripts/generate-resource.js"),
      "thing", "--full", "--dry-run",
    ], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("only generates DB-backed DTO types");
  });
});
