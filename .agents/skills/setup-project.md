# Setup Project

## Stack

- Next.js 15 (App Router, strict mode, static export)
- React 19
- TailwindCSS v4
- Bun runtime

## Commands

- Dev Server: `bun run dev`
- Build: `bun run build`

## Architecture

- **Fully client-side**: There are no API routes or backend components. All parsing and conversion happens in the browser to reduce latency and server costs.
- **Vercel deployment**: Optimized for static hosting.
