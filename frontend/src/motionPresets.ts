import { useReducedMotion } from 'framer-motion'
import type { Transition } from 'framer-motion'

export const EASE = 'easeOut' as const

/** The whole app moves on one ladder. Durations live here, not in components:
    a timing change is one edit instead of a hunt through every variant. */
export const MOTION = {
	page: { duration: 0.24, ease: EASE },
	tab: { duration: 0.18, ease: EASE },
	heroFade: { duration: 0.4, ease: EASE },
	reveal: { duration: 0.38, ease: EASE },
	height: { duration: 0.22, ease: EASE },
} as const satisfies Record<string, Transition>

export type MotionName = keyof typeof MOTION

/** Chart draw-in length in ms. Recharts takes its own animation props, so
    this one is a number rather than a framer Transition. */
export const DRAW_MS = 500

/**
 * Resolve a preset against the user's motion preference. Under
 * prefers-reduced-motion every preset snaps so nothing ever animates;
 * components never hardcode `duration: 0` themselves.
 */
export function transitionFor(name: MotionName, reduce: boolean): Transition {
	return reduce ? { duration: 0 } : MOTION[name]
}

export function useMotion(name: MotionName): Transition {
	return transitionFor(name, !!useReducedMotion())
}