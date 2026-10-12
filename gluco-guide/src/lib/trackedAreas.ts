// Optional areas a person can turn on or off. Food is always tracked, so it
// isn't listed. Stored on the member row as these stable keys; labels live
// in translation files under onboarding.trackAreas.<key>.
export const trackedAreaKeys = ["waterFiber", "exercise", "mindSleep", "supplements"] as const
export type TrackedArea = (typeof trackedAreaKeys)[number]

/** A missing setting (accounts from before this choice existed) means everything is on. */
export function resolveTrackedAreas(saved: string[] | null | undefined): Set<TrackedArea> {
  if (!saved) return new Set(trackedAreaKeys)
  return new Set(trackedAreaKeys.filter((key) => saved.includes(key)))
}
