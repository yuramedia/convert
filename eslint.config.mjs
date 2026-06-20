import { defineConfig, globalIgnores } from "eslint/config"
import js from "@eslint/js"

const eslintConfig = defineConfig([js.configs.recommended, globalIgnores(["dist/**", "build/**"])])

export default eslintConfig
