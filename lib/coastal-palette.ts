import type { CSSProperties } from "react"

/** Reference palette — peach, blush, midnight navy, slate navy and white. */
export const coastalPalette = {
  peach: "#FAF3DE",
  lavenderBlue: "#FAF3DE",
  blueGray: "#FAF3DE",
  dustyRose: "#40392F",
  teal: "#40392F",
  body: "#40392F",
  title: "#40392F",
  deep: "#40392F",
  cream: "#FAF3DE",
} as const

export const displayScript: CSSProperties = {
  fontFamily: "'Brightwall', cursive",
  fontWeight: 400,
}

export const coastalLightBg = coastalPalette.lavenderBlue
export const coastalDarkBg = coastalPalette.teal

export const coastalLightGradient = coastalLightBg
export const coastalDarkGradient = coastalDarkBg

export const coastalCardShadow = `0 16px 48px color-mix(in srgb, ${coastalPalette.teal} 14%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.72)`

export const coastalTitleShadow =
  "0 2px 4px rgba(255, 255, 255, 0.85), 0 0 16px rgba(250, 243, 222, 0.45)"
