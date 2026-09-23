import { useEffect, useMemo, useRef, useState } from 'react'
import { clamp, closedLoopPoles, presetDamping, zetaOmega } from '../LandingSim'
import type { LabParams } from '../LandingSim'
import PoleMini from './PoleMini'

const PHYS_TO_PX = 120
const BASE_X = 210
const WALL_X = 60
const MASS_W = 80
const MASS_H = 50
const REF = 1

const posPx = (p: number) => BASE_X + PHYS_TO_PX * p

function springPath(x0: number, x1: number, y: number, coils = 9): string {
	const len = x1 - x0
	const amplitude = clamp(len, 0, 26) / (coils + 0.5)
	const step = len / coils
	let d = `M ${x0.toFixed(1)} ${y.toFixed(1)}`
	let up = true
	for (let i = 1; i <= coils; i++) {
		const x = x0 + step * i
		const yy = up ? y - amplitude : y + amplitude
		d += ` L ${x.toFixed(1)} ${yy.toFixed(1)}`
		up = !up
	}
	return d
}

interface SimState {
	position: number
	velocity: number
	time: number
}

const PRESET_LABELS = [
	{ id: 'under', label: 'Underdamped' },
	{ id: 'critical', label: 'Critical' },
	{ id: 'over', label: 'Overdamped' },
] as const

type Mode = (typeof PRESET_LABELS)[number]['id']

export function MassSpringDamperSim({ m, k, kp, kd }: Omit<LabParams, 'c'>) {
	const [mode, setMode] = useState<Mode>('critical')
	const params = useMemo<LabParams>(
		() => ({ m, k, kp, kd, c: presetDamping(mode, { m, k, kp, kd }) }),
		[mode, m, k, kp, kd],
	)

	const [scene, setScene] = useState<SimState>({ position: 0, velocity: 0, time: 0 })
	const stateRef = useRef<SimState>({ position: 0, velocity: 0, time: 0 })
	const lastRef = useRef<number | null>(null)

	useEffect(() => {
		let raf = 0
		const dt = 1 / 240
		const endTime = 9
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick)
			if (lastRef.current === null) lastRef.current = now
			const elapsed = Math.min((now - lastRef.current) / 1000, 0.05)
			lastRef.current = now
			let steps = Math.round(elapsed / dt)
			const s = stateRef.current
			const { m: mass, c, k: springK, kp: p, kd: d } = params
			while (steps-- > 0) {
				const x1 = s.position
				const x2 = s.velocity
				const u = -p * (x1 - REF) - d * x2
				const a1 = (-springK * x1 - c * x2 + u) / mass
				const v2 = s.velocity + dt * a1
				const x3 = x1 + dt * v2
				const u2 = -p * (x3 - REF) - d * v2
				const a2 = (-springK * x3 - c * v2 + u2) / mass
				s.position = x1 + (dt / 2) * (v2 + (v2 + dt * a2))
				s.velocity = x2 + (dt / 2) * (a1 + a2)
				s.time += dt
				if (s.time >= endTime) {
					s.time = 0
					s.position = 0
					s.velocity = 0
				}
			}
			setScene({ position: s.position, velocity: s.velocity, time: s.time })
		}
		raf = requestAnimationFrame(tick)
		return () => {
			cancelAnimationFrame(raf)
			lastRef.current = null
		}
	}, [params])

	useEffect(() => {
		stateRef.current = { position: 0, velocity: 0, time: 0 }
		setScene({ position: 0, velocity: 0, time: 0 })
	}, [params])

	const massLeft = clamp(posPx(scene.position), WALL_X + 40, 500)
	const springY = 205
	const damperY = 250
	const refPx = posPx(REF)
	const poles = closedLoopPoles(params)
	const { zeta } = zetaOmega(params)

	return (
		<div className="lab-sim">
			<div className="lab-sim__presets">
				{PRESET_LABELS.map((label) => (
					<button
						key={label.id}
						className={mode === label.id ? 'chip active' : 'chip'}
						onClick={() => setMode(label.id)}
					>
						{label.label}
					</button>
				))}
			</div>

			<figure className="lab-sim__figure">
				<svg viewBox="0 0 560 300" className="lab-sim__svg" role="img" aria-label="Animated spring-mass-damper response">
					{/* ground */}
					<line x1="40" y1="285" x2="540" y2="285" className="lab-sim__ground" />

					{/* wall */}
					<rect x={WALL_X - 8} y="150" width="8" height="135" rx="2" className="lab-sim__wall" />

					{/* reference marker */}
					<g>
						<line x1={refPx} y1="170" x2={refPx} y2="285" className="lab-sim__ref-line" strokeDasharray="4 5" />
						<circle cx={refPx} cy="164" r="9" className="lab-sim__ref-dot" />
						<text x={refPx} y="168" textAnchor="middle" className="lab-sim__ref-label">r</text>
					</g>

					{/* damper: rod telescopes out of a housing that slides with the mass */}
					<g className="lab-sim__damper">
						<line x1={WALL_X} y1={damperY} x2={massLeft} y2={damperY} />
						<rect x={massLeft - 26} y={damperY - 8} width="26" height="16" rx="2" className="lab-sim__damper-housing" />
						<line x1={massLeft - 26} y1={damperY - 14} x2={massLeft - 26} y2={damperY + 14} className="lab-sim__damper-cap" />
						<line x1={massLeft} y1={damperY - 14} x2={massLeft} y2={damperY + 14} className="lab-sim__damper-cap" />
						<text x={(WALL_X + massLeft - 26) / 2} y={damperY + 22} textAnchor="middle" className="lab-sim__label">c</text>
					</g>

					{/* spring: recomputed every frame so it visibly deforms with the mass */}
					<path d={springPath(WALL_X + 6, massLeft, springY)} className="lab-sim__spring-hilite" />
					<path d={springPath(WALL_X + 6, massLeft, springY, 8)} className="lab-sim__spring" />
					<text x={(WALL_X + 6 + massLeft) / 2} y={springY - 18} textAnchor="middle" className="lab-sim__label">k</text>

					{/* mass */}
					<g>
						<rect x={massLeft} y={235} width={MASS_W} height={MASS_H} rx="5" className="lab-sim__mass" />
						<text x={(massLeft + massLeft + MASS_W) / 2} y={264} textAnchor="middle" className="lab-sim__mass-label">m</text>
						<circle cx={massLeft + 16} cy={287} r="6" className="lab-sim__wheel" />
						<circle cx={massLeft + MASS_W - 16} cy={287} r="6" className="lab-sim__wheel" />
					</g>
				</svg>
			</figure>

			<div className="lab-sim__telemetry">
				<div className="lab-sim__cell">
					<span className="lab-sim__cell-label">m</span>
					<span className="lab-sim__cell-value mono">{m.toFixed(2)} kg</span>
				</div>
				<div className="lab-sim__cell">
					<span className="lab-sim__cell-label">k</span>
					<span className="lab-sim__cell-value mono">{k.toFixed(2)} N/m</span>
				</div>
				<div className="lab-sim__cell">
					<span className="lab-sim__cell-label">c</span>
					<span className="lab-sim__cell-value mono">{params.c.toFixed(2)} N·s/m</span>
				</div>
				<div className="lab-sim__cell">
					<span className="lab-sim__cell-label">ζ</span>
					<span className="lab-sim__cell-value mono">{zeta.toFixed(2)}</span>
				</div>
				<div className="lab-sim__cell">
					<span className="lab-sim__cell-label">x</span>
					<span className="lab-sim__cell-value mono">{scene.position.toFixed(2)} m</span>
				</div>
				<div className="lab-sim__cell">
					<span className="lab-sim__cell-label">v</span>
					<span className="lab-sim__cell-value mono">{scene.velocity.toFixed(2)} m/s</span>
				</div>
				<PoleMini poles={poles} />
			</div>
		</div>
	)
}

export default MassSpringDamperSim