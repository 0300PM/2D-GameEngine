module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: ["dist", "release", "node_modules", "scripts", "playground.html", "docs"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "off"
  },
  overrides: [
    {
      files: ["packages/engine/src/core/**/*.ts", "packages/engine/src/components/**/*.ts", "packages/engine/src/systems/**/*.ts", "packages/engine/src/assets/**/*.ts", "packages/engine/src/project/**/*.ts", "packages/engine/src/save/**/*.ts", "packages/engine/src/animation/**/*.ts", "packages/engine/src/audio/**/*.ts", "packages/engine/src/debug/**/*.ts", "packages/engine/src/plugins/**/*.ts"],
      rules: {
        "no-restricted-imports": ["error", { patterns: [{ group: ["phaser", "phaser/*"], message: "Core must not depend on Phaser. Put adapter code in packages/engine/src/adapters." }] }],
        "no-restricted-globals": ["error", { name: "Phaser", message: "Core must not reference the Phaser global." }]
      }
    }
  ]
};
