# Contributing to Yuuume ASS Converter

Contributions are welcome — bug fixes, new features, test coverage, and documentation improvements all appreciated.

## Getting started

```bash
git clone https://github.com/yuramedia/convert
cd convert
bun install
bun run dev
```

Open [http://localhost:4321](http://localhost:4321) to see the app.

## Development workflow

```bash
bun run dev        # start dev server
vitest run         # run tests (or: vitest --watch for watch mode)
bun run lint       # check for lint errors
bun run format     # auto-format code
bun run build      # verify the production build
```

All tests must pass and the build must succeed before a PR can be merged.

## Project structure

```
src/
├── pages/             # Astro routing directory (pages)
├── layouts/           # Astro layout wrappers
├── styles/            # CSS styles (Tailwind v4)
├── components/        # React UI components
│   └── ui/            # Primitive UI components (shadcn/ui based)
└── lib/               # Pure conversion logic (no React)
    ├── ass-parser.ts  # ASS/SSA file parser (follows libass conventions)
    ├── ass-tags.ts    # Override tag tokenizer
    ├── srt-writer.ts  # SRT output formatter
    └── converters/    # One file per conversion mode
```

## Conventions

- **Tests live next to source files**: `ass-parser.ts` → `ass-parser.test.ts`. All test files import from `"vitest"`.
- **Parser follows libass**: See `.agents/skills/convert-ass.md` for detailed parsing rules. When in doubt, match libass behaviour.
- **No backend**: The app is fully client-side and statically exported. Do not add API routes or server actions.
- **TypeScript strict**: `tsconfig.json` has `"strict": true`. All new code must be fully typed.
- **Formatter**: `oxfmt` is the code formatter. Run `bun run format` before committing.

## Submitting a pull request

1. Fork the repo and create a feature branch from `main`.
2. Make your changes and add or update tests where relevant.
3. Run `vitest run` and `bun run build` — both must pass.
4. Open a PR with a clear description of what changed and why.

## Reporting issues

Open a GitHub issue with steps to reproduce, the input file (if relevant), and the expected vs actual output.
