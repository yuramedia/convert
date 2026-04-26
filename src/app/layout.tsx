import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"]
})

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"]
})

export const metadata: Metadata = {
    title: "ASS to SRT Converter — Subtitle Format Converter",
    description:
        "Convert ASS/SSA subtitles to SRT format with advanced options. Keep typesetting tags, resample resolution, or strip to clean SRT. Client-side, serverless, instant.",
    keywords: [
        "ASS to SRT",
        "subtitle converter",
        "typesetting",
        "fansubbing",
        "libass",
        "aegisub",
        "resolution resample"
    ],
    openGraph: {
        title: "ASS to SRT Converter",
        description: "Convert ASS subtitles to SRT with TS preservation, resolution resampling, or clean output.",
        type: "website"
    }
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col">
                <div className="bg-gradient-animated" aria-hidden="true" />
                {children}
            </body>
        </html>
    )
}
