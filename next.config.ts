import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    output: "export",
    trailingSlash: true,
    images: {
        unoptimized: true
    },
    experimental: {
        optimizePackageImports: ["lucide-react"]
    }
}

export default nextConfig
