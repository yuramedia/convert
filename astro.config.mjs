import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { satteri } from "@astrojs/markdown-satteri"

export default defineConfig({
    integrations: [react()],
    output: "static",
    site: "https://convert.yuramedia.com",
    trailingSlash: "always",
    fetchFile: null,
    markdown: {
        shikiConfig: {
            theme: "aurora-x",
            wrap: true
        },
        processor: satteri({
            features: { gfm: false }
        })
    },
    vite: {
        plugins: [tailwindcss()],
        resolve: {
            alias: { "@": "/src" }
        }
    }
})
