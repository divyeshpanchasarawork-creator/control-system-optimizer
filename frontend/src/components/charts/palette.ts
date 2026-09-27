/**
 * Chart colours live in theme.css so a plot can never drift from the UI around
 * it. Recharts needs literal colour strings: its stroke/fill props land on SVG
 * presentation attributes, and `var()` does not resolve there in every browser.
 * So read the tokens off :root once and hand the charts concrete values.
 */
const TOKENS = {
	blue: '--blue',
	green: '--chart-green',
	amber: '--amber',
	red: '--red',
	violet: '--chart-violet',
	cyan: '--chart-cyan',
	pink: '--chart-pink',
	olive: '--chart-olive',
	axis: '--chart-axis',
	grid: '--chart-grid',
	zero: '--chart-zero',
	hatch: '--chart-hatch',
	hatch2: '--chart-hatch-2',
	ink: '--text',
	muted: '--text-3',
} as const

export type ChartColor = keyof typeof TOKENS

let cache: Record<ChartColor, string> | null = null

/**
 * The theme is static (no dark-mode toggle, no prefers-color-scheme), so one
 * read after the stylesheet lands is enough. Called during render, which is
 * after main.tsx has imported the CSS in both dev and the built bundle.
 */
export function chartColors(): Record<ChartColor, string> {
	if (cache === null) {
		const styles = getComputedStyle(document.documentElement)
		const read = {} as Record<ChartColor, string>
		for (const [name, token] of Object.entries(TOKENS) as [ChartColor, string][]) {
			read[name] = styles.getPropertyValue(token).trim()
		}
		cache = read
	}
	return cache
}

/** Diagonal hatch for cells where the system is infeasible or unstable. */
export function hatchPattern(c: Record<ChartColor, string>): string {
	return `repeating-linear-gradient(45deg, ${c.hatch} 0 4px, ${c.hatch2} 4px 8px)`
}
