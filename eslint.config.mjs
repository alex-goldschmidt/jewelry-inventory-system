import { createRequire } from "node:module";

// The repository's Node toolchain is installed in server/.
const require = createRequire(new URL("./server/package.json", import.meta.url));
const tseslint = require("typescript-eslint");

export default [
  {
    ignores: [
      "**/node_modules/**", "**/dist/**", "**/coverage/**",
      // Third-party output only; handwritten client code uses the rules below.
      "client/src/api/generated/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "@typescript-eslint": tseslint.plugin },
    linterOptions: { noInlineConfig: true },
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression:not([typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.type='Identifier'][typeAnnotation.typeName.name='const']), TSTypeAssertion",
          message: "Only as const assertions are allowed. Use checked annotations, satisfies, narrowing, or runtime validation for other types.",
        },
        {
          selector: "PropertyDefinition[definite=true], VariableDeclarator[definite=true]",
          message: "Definite assignment assertions are forbidden. Initialize the value or check it before use.",
        },
        {
          selector: "TSEnumDeclaration",
          message: "Enums are forbidden. Use a const object with as const and derive its value union with typeof and keyof.",
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-expect-error": true, "ts-nocheck": true, "ts-check": false },
      ],
    },
  },
];
