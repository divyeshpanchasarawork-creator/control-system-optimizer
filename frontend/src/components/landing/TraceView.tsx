import type { ReactNode } from 'react'
import type { SamplePoint } from './LandingSim'

export interface TraceOptions {
	label?: string
	color?: string
}

const W = 520
const H = 240
const PAD_L = 44
const PAD_R = 14
const PAD_T = 14
const PAD_B = 30

function xScale(t: number, tMax: number): number {
	return PAD_L + (t / tMax) * (W - PAD_L - PAD_R)
}

function yScale(p: number, ref: number): number {
	const spread = Math.max(1.6 * ref, 1.4)
	const base = ref
	return PAD_T + ((base + spread / 2 - Math.max(Math.min(p, base + spread / 2), base - spread / 2)) / spread) * (H - PAD_T - PAD_B)
}

export function pointsToPath(points: SamplePoint[], tMax: number, ref: number): string {
	return points
		.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t, tMax).toFixed(1)} ${yScale(p.position, ref).toFixed(1)}`)
		.join(' ')
}

interface StepTraceProps {
	tMax?: number
	ref?: number
	children?: ReactNode
}

export function StepTraceView({ tMax = 8, ref = 1, children }: StepTraceProps) {
	const refY = yScale(ref, ref)
	const zeroY = yScale(0, ref)

	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="trace" role="img" aria-label="Step response trace">
			{/* gridlines */}
			{[0, 0.5, 1, 1.5].map((g) => (
				<line key={g} x1={PAD_L} y1={yScale(g, ref)} x2={W - PAD_R} y2={yScale(g, ref)} className="trace__grid" />
			))}
			{[1, 2, 4].concat(tMax > 6 ? [6, 8] : []).map((t) => (
				<line key={t} x1={xScale(t, tMax)} y1={PAD_T} x2={xScale(t, tMax)} y2={H - PAD_B} className="trace__grid" />
			))}

			{/* reference */}
			<line x1={PAD_L} y1={refY} x2={W - PAD_R} y2={refY} stroke="#0a84ff" strokeDasharray="6 5" strokeWidth="1.2" />
			<text x={W - PAD_R - 4} y={refY - 4} textAnchor="end" className="trace__tick">r</text>

			{children}

			{/* axes */}
			<line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} className="trace__axis" />
			<line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} className="trace__axis" />
			<text x={PAD_L} y={zeroY + 14} className="trace__tick">0</text>
			<text x={W - PAD_R} y={H - PAD_B + 18} textAnchor="end" className="trace__tick">t (s)</text>
		</svg>
	)
}

export default StepTraceView