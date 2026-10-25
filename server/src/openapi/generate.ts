import fs from "fs";
import path from "path";
import { createOpenApiDocument } from "./document";

const outputPath = path.resolve(__dirname, "../../openapi.json");
const renderedDocument = `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`;
const isCheckMode = process.argv.includes("--check");

if (isCheckMode) {
  const existingDocument = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8")
    : "";

  if (existingDocument !== renderedDocument) {
    console.error(`OpenAPI spec is out of date at ${outputPath}`);
    process.exitCode = 1;
  } else {
    console.log(`OpenAPI spec is up to date at ${outputPath}`);
  }
} else {
  fs.writeFileSync(outputPath, renderedDocument);
  console.log(`OpenAPI spec written to ${outputPath}`);
}
