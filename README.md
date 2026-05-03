# ASS to SRT Subtitle Converter

A modern web-based tool for converting Advanced SubStation Alpha (ASS) subtitle files to SubRip (SRT) format with multiple conversion modes and advanced options.

## Features

- **Multiple Conversion Modes**:
    - **Normal**: Standard strip with basic HTML tag removal
    - **Keep TS**: Preserve all override tags for advanced formatting control
    - **Resample**: Scale coordinate metrics for different video resolutions

- **Advanced Options**:
    - Customizable timing offset and scaling
    - Frame gap detection and handling
    - Support for `\\an` (alignment) tag injection
    - Various timing adjustment modes

- **User-Friendly Interface**:
    - Drag-and-drop file upload
    - Real-time preview of converted output
    - Download converted files directly
    - Responsive design with modern UI components

- **High-Quality Standards**:
    - Comprehensive test coverage for all converters
    - Parse and validate ASS format files following libass conventions
    - Support for complex ASS features (styles, effects, positioning)

## Getting Started

### Prerequisites

- **Bun 1.0+** (recommended) or Node.js 18+
- Package manager: Bun (built-in), npm, yarn, or pnpm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd convert
```

2. Install dependencies:

```bash
bun install
# or alternatively:
npm install
yarn install
pnpm install
```

### Development

Run the development server:

```bash
bun run dev
# or alternatively:
npm run dev
yarn dev
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to use the converter.

### Build

Build the project for production:

```bash
bun run build
# or: npm run build
```

Start the production server:

```bash
bun start
# or: npm start
```

## Usage

1. **Upload a File**: Drag and drop an ASS subtitle file onto the upload area or click to select
2. **Choose Conversion Mode**: Select from Normal, Keep TS, or Resample modes
3. **Configure Options**: Adjust timing, scaling, or other conversion parameters as needed
4. **Preview & Download**: Review the output preview and download the converted SRT file

## Conversion Modes

### Normal Mode

Removes inline styling tags and converts to standard SRT format. Best for simple subtitle files that don't require complex formatting preservation.

### Keep TS Mode

Preserves all ASS override tags (like `\c`, `\b`, `\i`, etc.) in the output. Useful when you need to maintain styling information in the converted file.

### Resample Mode

Scales subtitle positioning and coordinates based on video resolution changes. Use this when converting subtitles from one video resolution to another.

## Project Structure

```
src/
├── app/                          # Next.js app directory
│   ├── page.tsx                  # Main converter page
│   ├── about/page.tsx            # About page
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── file-dropzone.tsx         # File upload component
│   ├── mode-selector.tsx         # Conversion mode selector
│   ├── options-panel.tsx         # Options configuration
│   ├── output-preview.tsx        # Output display
│   └── ui/                       # UI component library
├── lib/                          # Core conversion logic
│   ├── ass-parser.ts             # ASS file parser
│   ├── ass-writer.ts             # ASS file writer
│   ├── srt-writer.ts             # SRT file writer
│   ├── converters/               # Conversion implementations
│   │   ├── normal-srt.ts
│   │   ├── keep-ts.ts
│   │   └── resample-ts.ts
│   └── *.test.ts                 # Test files
```

## Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun start` - Start production server
- `bun run lint` - Run linting checks
- `bun run format` - Format code
- `bun test` - Run test suite

## Technologies Used

- **Next.js 16** - React framework with SSR and static generation
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality UI component library
- **Vitest** - Unit testing framework
- **Bun** - Fast JavaScript runtime and package manager

## Testing

Run the test suite:

```bash
bun test
# or: npm test
```

The project includes comprehensive tests for:

- ASS parser and writer
- SRT writer
- All conversion modes
- Tag handling and transformations

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests to help improve the converter.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide React](https://lucide.dev/)
- Follows [libass](https://github.com/libass/libass) ASS format conventions
