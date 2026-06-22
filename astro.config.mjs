import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
    integrations: [react()],
    output: "static",
    site: "https://convert.yuramedia.com",
    trailingSlash: "always",
    fetchFile: null,
    vite: {
        plugins: [tailwindcss()],
        resolve: {
            alias: { "@": "/src" }
        }
    }
})
