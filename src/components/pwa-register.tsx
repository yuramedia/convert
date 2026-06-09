"use client"

import { useEffect } from "react"

export default function PwaRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", () => {
                navigator.serviceWorker
                    .register("/sw.js", { scope: "/" })
                    .then(reg => {
                        console.log("Service Worker registered with scope:", reg.scope)
                    })
                    .catch(err => {
                        console.error("Service Worker registration failed:", err)
                    })
            })
        }
    }, [])

    return null
}
