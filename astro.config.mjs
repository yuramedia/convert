import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { satteri } from "@astrojs/markdown-satteri"

export default defineConfig({
    integrations: [react()],
    output: "static",
    site: "https://convert.yuramedia.com",
    trailingSlash: "always",
    // Inline small stylesheets, prefetch same-origin pages for instant navigation
    build: {
        inlineStylesheets: "always"
    },
    prefetch: {
        prefetchAll: true
    },
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
        },
        define: {
            // Injected into the service worker for cache-busting per deploy
            "self.__BUILD_ID__": JSON.stringify(process.env.GITHUB_SHA ?? Date.now().toString(36))
        }
    }
})
