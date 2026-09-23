import { useMemo, useState } from 'react'
import { closedLoopPoles, settleTime, simulateClosedLoop, zetaOmega } from './LandingSim'
import PoleMini from './hero/PoleMini'
import { StepTraceView, pointsToPath } from './TraceView'

const PLANT = { m: 1, k: 2, c: 0.5 }
const REF = 1
const T_MAX = 8
const BASELINE = { ...PLANT, kp: 3, kd: 0.3 }

function overshoot(points: { position: number }[], ref: number): number {
	let peak = -Infinity
	for (const p of points) peak = Math.max(peak, p.position)
	return peak > ref ? ((peak - ref) / ref) * 100 : 0
}

export function TuneSection() {
	const [kp, setKp] = useState(12)
	const [kd, setKd] = useState(6)

	const params = useMemo(() => ({ ...PLANT, kp, kd }), [kp, kd])
	const response = useMemo(() => simulateClosedLoop(params, REF, [0, 0], T_MAX), [params])
	const baseline = useMemo(() => simulateClosedLoop(BASELINE, REF, [0, 0], T_MAX), [])
	const { zeta, omegaN } = zetaOmega(params)
	const settle = settleTime(params, REF, 5, 20)
	const poles = closedLoopPoles(params)
	const os = overshoot(response, REF)

	return (
		<div className="tune">
			<div className="tune__sliders">
				<label className="tune__slider">
					<span className="tune__slider-top">
						<span className="tune__slider-label">
							Proportional <code>Kp</code>
						</span>
						<span className="tune__slider-value mono">{kp.toFixed(0)}</span>
					</span>
					<input type="range" min={0} max={30} step={1} value={kp} onChange={(e) => setKp(Number(e.target.value))} className="tune__input" aria-label="Proportional gain Kp" />
				</label>

				<label className="tune__slider">
					<span className="tune__slider-top">
						<span className="tune__slider-label">
							Derivative <code>Kd</code>
						</span>
						<span className="tune__slider-value mono">{kd.toFixed(1)}</span>
					</span>
					<input type="range" min={0} max={15} step={0.5} value={kd} onChange={(e) => setKd(Number(e.target.value))} className="tune__input" aria-label="Derivative gain Kd" />
				</label>
			</div>

			<div className="tune__plot">
				<div className="tune__legend">
					<span className="tune__legend-item">
						<span className="tune__legend-line tune__legend-line--baseline" /> Poorly tuned
					</span>
					<span className="tune__legend-item">
						<span className="tune__legend-line" /> Current gains
					</span>
				</div>
				<StepTraceView tMax={T_MAX} ref={REF}>
					<path d={pointsToPath(baseline, T_MAX, REF)} className="trace__line trace__line--baseline" fill="none" />
					<path d={pointsToPath(response, T_MAX, REF)} className="trace__line" fill="none" />
				</StepTraceView>
			</div>

			<div className="tune__readouts">
				<div className="tune__metric">
					<span className="tune__metric-label">Damping ratio ζ</span>
					<span className="tune__metric-value mono">{zeta.toFixed(2)}</span>
				</div>
				<div className="tune__metric">
					<span className="tune__metric-label">Natural freq ωn</span>
					<span className="tune__metric-value mono">{omegaN.toFixed(1)} rad/s</span>
				</div>
				<div className="tune__metric">
					<span className="tune__metric-label">Overshoot</span>
					<span className="tune__metric-value mono">{os.toFixed(1)}%</span>
				</div>
				<div className="tune__metric">
					<span className="tune__metric-label">Settle (5%)</span>
					<span className="tune__metric-value mono">{settle === null || settle > T_MAX ? 'Not reached' : `${settle.toFixed(2)} s`}</span>
				</div>
				<PoleMini poles={poles} />
			</div>
		</div>
	)
}

export default TuneSection