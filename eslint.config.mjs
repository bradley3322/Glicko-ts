import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";

export default [
  {
    ignores: [
        "node_modules/", 
        "dist/",        
        "build/",        
        
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"], 
    languageOptions: {
        globals: {
            ...globals.node, 
        },
    },
  },
  ...tseslint.configs.recommended,
  { 
    files: ["**/*.{jsx,tsx}"],
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
        ...pluginReact.configs.flat.recommended.languageOptions, 
        globals: { 
            ...globals.browser,
        }
    },
    settings: { 
        react: {
            version: "detect",
        },
    },
  },
]
