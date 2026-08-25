import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * 0-based column index → spreadsheet-style letters (0 → "A", 25 → "Z", 26 → "AA", …)
 */
export function getColumnLetter(index: number): string {
    let letters = ""
    let n = index
    while (n >= 0) {
        letters = String.fromCharCode(65 + (n % 26)) + letters
        n = Math.floor(n / 26) - 1
    }
    return letters
}
