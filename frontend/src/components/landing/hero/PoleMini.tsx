import type { Complex } from '../LandingSim'

interface Props {
	poles: Complex[]
	animate?: boolean
}

function poleX(real: number): number {
	// real axis spans [-12, 4] mapped onto [14, 126]
	const v = Math.max(-12, Math.min(4, real))
	return 14 + ((v - -12) / (4 - -12)) * 112
}

function poleY(imag: number): number {
	// imaginary axis spans [-10, 10] mapped onto [104, 16]
	const v = Math.max(-10, Math.min(10, imag))
	return 16 + ((v - 10) / (10 - -10)) * (104 - 16)
}

export function PoleMini({ poles, animate = true }: Props) {
	const originX = poleX(0)
	const originY = poleY(0)
	const stable = poles.length > 0 && poles.every((p) => p.real < 0)

	return (
		<figure className="pole-mini">
			<figcaption className="pole-mini__caption">CLOSED LOOP</figcaption>
			<svg viewBox="0 0 140 120" className="pole-mini__svg" role="img" aria-label="Closed-loop pole locations">
				{/* coarse grid */}
				{[-8, -4, 0].map((r) => (
					<line key={`r${r}`} x1={poleX(r)} y1="16" x2={poleX(r)} y2="104" className="pole-mini__grid" strokeDasharray="2 4" />
				))}
				{[-5, 0, 5].map((im) => (
					<line key={`i${im}`} x1="14" y1={poleY(im)} x2="126" y2={poleY(im)} className="pole-mini__grid" strokeDasharray="2 4" />
				))}
				{/* axes */}
				<line x1="14" y1={originY} x2="126" y2={originY} className="pole-mini__axis" />
				<line x1={originX} y1="16" x2={originX} y2="104" className="pole-mini__axis" />
				{/* stability boundary always traced */}
				<line x1={originX} y1="16" x2={originX} y2="104" className="pole-mini__boundary" />
				<text x="126" y={originY - 3} textAnchor="end" className="pole-mini__tick">Re</text>
				<text x={originX + 3} y="18" className="pole-mini__tick">Im</text>
				{poles.map((p, i) => (
					<g key={i} className={animate ? 'pole-mini__pole' : ''}>
						<line x1={poleX(p.real) - 5} y1={poleY(p.imag) - 5} x2={poleX(p.real) + 5} y2={poleY(p.imag) + 5} className="pole-mini__pole-x" />
						<line x1={poleX(p.real) - 5} y1={poleY(p.imag) + 5} x2={poleX(p.real) + 5} y2={poleY(p.imag) - 5} className="pole-mini__pole-x" />
					</g>
				))}
			</svg>
			<div className="pole-mini__state">{stable ? 'Stable' : 'Unstable'}</div>
		</figure>
	)
}

export default PoleMini