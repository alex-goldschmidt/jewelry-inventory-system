import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const clientRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedRoot = path.join(clientRoot, "src/api/generated");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "heyapi-check-"));

function filesIn(directory, relative = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(relative, entry.name);
    return entry.isDirectory() ? filesIn(path.join(directory, entry.name), name) : [name];
  }).sort();
}

try {
  const result = spawnSync(process.execPath, [
    path.join(clientRoot, "node_modules/@hey-api/openapi-ts/bin/run.js"),
    "--output", temporaryRoot,
  ], { cwd: clientRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Hey API generation failed");
  const generatedFiles = filesIn(temporaryRoot);
  const existingFiles = fs.existsSync(expectedRoot) ? filesIn(expectedRoot) : [];
  const names = new Set([...generatedFiles, ...existingFiles]);
  const changed = [...names].filter((name) => {
    const generated = path.join(temporaryRoot, name);
    const existing = path.join(expectedRoot, name);
    return !fs.existsSync(generated) || !fs.existsSync(existing)
      || !fs.readFileSync(generated).equals(fs.readFileSync(existing));
  });
  if (changed.length) {
    throw new Error(`Generated API client is out of date: ${changed.join(", ")}. Run npm run api:generate in client/.`);
  }
  console.log("Generated API client is up to date.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
