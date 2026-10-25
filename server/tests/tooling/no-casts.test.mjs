import { ESLint } from "eslint";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const eslint = new ESLint({
  cwd: fileURLToPath(new URL("../../..", import.meta.url)),
});

describe("repository type safety policy", () => {
  for (const code of [
    "const value = input as string;",
    "const value = <string>input;",
    "const value = input as unknown as string;",
    'const value = (input as { Active: "ACTIVE" }) as const;',
    'const value = <const>{ Active: "ACTIVE" };',
    "const value = input!;",
    "class Example { value!: string; }",
    "let value!: string;",
    "let value: any;",
    'enum Status { Active = "ACTIVE" }',
    'const enum Status { Active = "ACTIVE" }',
    "// @ts-ignore\nconst value: string = 1;",
    "// @ts-expect-error\nconst value: string = 1;",
    "// @ts-nocheck\nconst value: string = 1;",
    "/* eslint-disable */\nconst value = input as string;",
  ]) {
    it(`rejects unsafe overrides: ${code}`, async () => {
      for (const filePath of [
        "server/src/probe.ts",
        "server/tests/probe.ts",
        "client/src/probe.ts",
        "future-package/probe.ts",
      ]) {
        const [result] = await eslint.lintText(code, { filePath });
        assert.ok(result.errorCount > 0, `${filePath}: ${code}`);
        assert.equal(
          result.fatalErrorCount,
          0,
          "Policy must reject syntax through lint rules, not parse errors"
        );
      }
    });
  }

  for (const code of [
    'const value = "literal" as const;',
    'const values = ["ACTIVE", "INACTIVE"] as const;',
    `const Status = { Active: "ACTIVE", Inactive: "INACTIVE" } as const;
     type StatusKey = keyof typeof Status;
     type StatusValue = (typeof Status)[StatusKey];
     const status: StatusValue = Status.Active;`,
  ]) {
    it(`allows as const: ${code}`, async () => {
      for (const filePath of [
        "server/src/probe.ts",
        "server/tests/probe.ts",
        "client/src/probe.ts",
        "future-package/probe.ts",
      ]) {
        const [result] = await eslint.lintText(code, { filePath });
        assert.equal(result.errorCount, 0, `${filePath}: ${code}`);
      }
    });
  }

  it("exempts only Hey API output, including no exemption for generated server DTOs", async () => {
    assert.equal(await eslint.isPathIgnored("client/src/api/generated/sdk.gen.ts"), true);
    assert.equal(await eslint.isPathIgnored("client/src/api/client.ts"), false);
    assert.equal(await eslint.isPathIgnored("server/src/dtos/user.dto.ts"), false);
  });

  it("allows checked annotations, satisfies, and runtime narrowing", async () => {
    const [result] = await eslint.lintText(`
      const value: string = "ok";
      const config = { value } satisfies { value: string };
      const Status = { Active: "ACTIVE", Inactive: "INACTIVE" } as const;
      type StatusValue = (typeof Status)[keyof typeof Status];
      const status: StatusValue = Status.Active;
      function read(input: unknown): string {
        if (typeof input !== "string") throw new Error("Invalid input");
        return input;
      }
    `, { filePath: "server/src/probe.ts" });
    assert.equal(result.errorCount, 0);
  });
});
