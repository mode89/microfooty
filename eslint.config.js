import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  prettier,
  {
    files: ["web/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
];
