/**
 * Shared option types and defaults for export converters.
 *
 * Kept dependency-free so UI shells can import defaults without pulling
 * heavy implementation modules (xlsx-js-style, ytt pipeline) into the
 * initial bundle.
 */

// ─── CSV ─────────────────────────────────────────────────────────────────────

export interface CsvExportOptions {
    useHtmlTags: boolean
    stripSigns?: boolean
    showIndex: boolean
    showStart: boolean
    showEnd: boolean
    showDuration: boolean
    showActor: boolean
    showStyle: boolean
    showLayer: boolean
    showText: boolean
}

export const DEFAULT_CSV_OPTIONS: Required<CsvExportOptions> = {
    useHtmlTags: true,
    stripSigns: false,
    showIndex: true,
    showStart: true,
    showEnd: true,
    showDuration: true,
    showActor: true,
    showStyle: false,
    showLayer: false,
    showText: true
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

export interface XlsxExportOptions {
    useHtmlTags: boolean
    stripSigns?: boolean
    showIndex: boolean
    showStart: boolean
    showEnd: boolean
    showDuration: boolean
    showActor: boolean
    showStyle: boolean
    showLayer: boolean
    showText: boolean
    combinedMode?: "sheets" | "single"
}

export const DEFAULT_XLSX_OPTIONS: Required<XlsxExportOptions> = {
    useHtmlTags: true,
    stripSigns: false,
    showIndex: true,
    showStart: true,
    showEnd: true,
    showDuration: true,
    showActor: true,
    showStyle: false,
    showLayer: false,
    showText: true,
    combinedMode: "sheets"
}

// ─── YTT ─────────────────────────────────────────────────────────────────────

export interface YttExportOptions {
    /** Background box opacity override: 0 = use style-derived value, >0 = force this opacity on all pens (default: 0) */
    wfo: number
    /** Convert pure white (#FFFFFF) to off-white (#FEFEFE) for YouTube Android compatibility (default: true) */
    useOffWhite: boolean
    /** Convert ASS \k karaoke tags to inline timed spans <s> (default: true) */
    convertKaraoke: boolean
    /** Convert ASS alignment (\an) and position (\pos) tags to window positions <wp> (default: true) */
    convertPositioning: boolean
    /** Apply YouTube player enhancement workarounds (italic prefetch, dark text hack, etc.) per YTSubConverter (default: true) */
    applyEnhancements: boolean
}

export const DEFAULT_YTT_OPTIONS: YttExportOptions = {
    wfo: 0,
    useOffWhite: true,
    convertKaraoke: true,
    convertPositioning: true,
    applyEnhancements: true
}

// ─── Resample ────────────────────────────────────────────────────────────────

/** Resolution presets shared by the resampler UI. Lives here (not in
 *  resample-ts.ts) so UI shells don't pull the conversion engine into the
 *  initial bundle just to render a dropdown. */
export const RESOLUTION_PRESETS: { label: string; width: number; height: number }[] = [
    { label: "640×360 (nHD widescreen)", width: 640, height: 360 },
    { label: "640×480 (VGA fullscreen)", width: 640, height: 480 },
    { label: "720×480 (NTSC storage)", width: 720, height: 480 },
    { label: "848×480 (NTSC display 16:9)", width: 848, height: 480 },
    { label: "720×576 (PAL storage)", width: 720, height: 576 },
    { label: "1024×576 (PAL display 16:9)", width: 1024, height: 576 },
    { label: "1280×720 (HD 720p)", width: 1280, height: 720 },
    { label: "1920×1080 (FHD 1080p)", width: 1920, height: 1080 },
    { label: "2560×1440 (QHD 1440p)", width: 2560, height: 1440 },
    { label: "3840×2160 (4K UHD 2160p)", width: 3840, height: 2160 },
    { label: "1080×1920 (FHD vertical)", width: 1080, height: 1920 }
]
