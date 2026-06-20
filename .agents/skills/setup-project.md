# Setup Project

## Stack

- Astro 6 (static output, file-based routing)
- React 19 (as Astro islands via `@astrojs/react`)
- TailwindCSS v4
- Bun runtime

## Commands

- Dev Server: `bun run dev`
- Build: `bun run build`
- Test: `vitest run`
- Lint: `oxlint`
- Format: `oxfmt .`

## Architecture

- **Fully client-side**: There are no API routes or backend components. All parsing and conversion happens in the browser to reduce latency and server costs.
- **Static output**: `astro.config.mjs` sets `output: "static"`. No server-side rendering or API routes.
- **React islands**: Interactive components use `client:load` directive in `.astro` page wrappers. Pure TS/JS stays in `src/lib/`.
- **GitHub Pages deployment**: The CI/CD pipeline builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`. Build output goes to `dist/`.
- **Vercel deployment**: `vercel.json` includes security headers for Vercel hosting as an alternative.

## Testing

- Test runner: **Vitest** (`vitest run`)
- All test files are in `src/lib/**/*.test.ts`
- Tests import from `"vitest"` — do NOT use Bun's native test runner
