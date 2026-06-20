import { defineConfig } from "astro/config"
import react from "@astrojs/react"

export default defineConfig({
    integrations: [react()],
    output: "static",
    site: "https://convert.yuramedia.com",
    trailingSlash: "always",
    vite: {
        resolve: {
            alias: { "@": "/src" }
        }
    }
})
