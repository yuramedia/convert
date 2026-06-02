import { ImageResponse } from "next/og"

export const dynamic = "force-static"
export const alt = "Yuuume ASS Converter"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function OgImage() {
    return new ImageResponse(
        <div
            style={{
                background: "#09090b",
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                fontFamily: "sans-serif",
                position: "relative"
            }}
        >
            {/* Subtle radial glow */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 800,
                    height: 400,
                    background: "radial-gradient(ellipse at top, rgba(37,99,235,0.15) 0%, transparent 70%)",
                    pointerEvents: "none"
                }}
            />
            {/* Icon row */}
            <div style={{ display: "flex", gap: 12 }}>
                <div
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        background: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        fontWeight: 900,
                        color: "#ffffff"
                    }}
                >
                    A
                </div>
                <div
                    style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        background: "#dc2626",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        fontWeight: 900,
                        color: "#ffffff"
                    }}
                >
                    S
                </div>
            </div>
            {/* Title */}
            <div
                style={{
                    fontSize: 64,
                    fontWeight: 800,
                    color: "#f4f4f5",
                    letterSpacing: "-2px",
                    textTransform: "uppercase",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center"
                }}
            >
                <span>Yuuume&nbsp;</span>
                <span style={{ color: "#3b82f6" }}>ASS</span>
                <span>&nbsp;Converter</span>
            </div>
            {/* Subtitle */}
            <div
                style={{
                    fontSize: 24,
                    color: "#71717a",
                    fontWeight: 500,
                    letterSpacing: "0.05em"
                }}
            >
                ASS to SRT | CSV | XLSX | Fully client-side
            </div>
        </div>,
        { ...size }
    )
}
