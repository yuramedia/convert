# Setup Project

## Stack

- Next.js 16 (App Router, strict mode, static export)
- React 19
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
- **Static export**: `next.config.ts` sets `output: "export"`. No server-side rendering or API routes.
- **GitHub Pages deployment**: The CI/CD pipeline builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
- **Vercel deployment**: `vercel.json` includes security headers for Vercel hosting as an alternative.

## Testing

- Test runner: **Vitest** (`vitest run`)
- All test files are in `src/lib/**/*.test.ts`
- Tests import from `"vitest"` — do NOT use Bun's native test runner
