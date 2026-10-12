import { readFileSync } from 'node:fs'

export const fixture = (path: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${path}`, import.meta.url)))

/** A fixed reading time, so a Reading is the same every run. */
export const readAt = '2026-10-12T12:00:00.000Z'
