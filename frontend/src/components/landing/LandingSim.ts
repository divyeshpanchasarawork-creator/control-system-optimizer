export interface LabParams {
	m: number
	k: number
	c: number
	kp: number
	kd: number
	/**
	 * Reference feedforward, the same term the lab's controller applies as
	 * `u = -K(x - r) + kff*r`. With proportional and derivative feedback only
	 * there is no integral action, so without it the loop parks below the
	 * reference at `kp/(k + kp)` of it and never settles into the band.
	 * Defaults to the plant stiffness, which is what the lab uses.
	 */
	kff?: number
}

export interface SamplePoint {
	t: number
	position: number
	velocity: number
	control: number
}

export interface Complex {
	real: number
	imag: number
}

/** Closed-loop matrix A - B*K for the spring-damper with state feedback u = -K(x - r). */
function closedLoopMatrix(p: LabParams): { a: number; b: number; c: number; d: number } {
	const { m, k, c, kp, kd } = p
	return { a: 0, b: 1, c: -(k + kp) / m, d: -(c + kd) / m }
}

/** Eigenvalues of [[a,b],[c,d]] as two complex poles. */
function eigenvalues2x2(a: number, b: number, c: number, d: number): [Complex, Complex] {
	const trace = a + d
	const det = a * d - b * c
	const disc = trace * trace - 4 * det
	if (disc >= 0) {
		const s = Math.sqrt(disc)
		return [{ real: (trace - s) / 2, imag: 0 }, { real: (trace + s) / 2, imag: 0 }]
	}
	const real = trace / 2
	const imag = Math.sqrt(-disc) / 2
	return [{ real, imag }, { real, imag: -imag }]
}

/** Closed-loop poles of the full system under the state-feedback gain K. */
export function closedLoopPoles(p: LabParams): Complex[] {
	const { a, b, c, d } = closedLoopMatrix(p)
	const [p1, p2] = eigenvalues2x2(a, b, c, d)
	return [p1, p2]
}

export function isStable(p: LabParams): boolean {
	return closedLoopPoles(p).every((z) => z.real < 0)
}

/** Natural frequency and damping ratio of the closed-loop dynamics. */
export function zetaOmega(p: LabParams): { zeta: number; omegaN: number } {
	const { m, k, c, kp, kd } = p
	const kEff = k + kp
	const cEff = c + kd
	const omegaN = Math.sqrt(kEff / m)
	const zeta = cEff / (2 * m * omegaN)
	return { zeta, omegaN }
}

/** Derivative of the closed-loop state; u = -K(x - r) + kff*r. */
function derivative(p: LabParams, ref: number, state: [number, number]): [number, number] {
	const { m, k, c, kp, kd } = p
	const kff = p.kff ?? k
	const x1 = state[0]
	const x2 = state[1]
	const u = -kp * (x1 - ref) - kd * x2 + kff * ref
	return [x2, (-k * x1 - c * x2 + u) / m]
}

function stepRK4(p: LabParams, ref: number, state: [number, number], dt: number): [number, number] {
	const k1 = derivative(p, ref, state)
	const s2: [number, number] = [state[0] + (dt / 2) * k1[0], state[1] + (dt / 2) * k1[1]]
	const k2 = derivative(p, ref, s2)
	const s3: [number, number] = [state[0] + (dt / 2) * k2[0], state[1] + (dt / 2) * k2[1]]
	const k3 = derivative(p, ref, s3)
	const s4: [number, number] = [state[0] + dt * k3[0], state[1] + dt * k3[1]]
	const k4 = derivative(p, ref, s4)
	return [
		state[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
		state[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
	]
}

/** Full closed-loop step response sampled at dt. */
export function simulateClosedLoop(
	p: LabParams,
	ref: number,
	initial: [number, number],
	endTime: number,
	dt = 0.005,
): SamplePoint[] {
	const points: SamplePoint[] = []
	let state: [number, number] = initial
	const { kp, kd, k } = p
	const kff = p.kff ?? k
	for (let t = 0; t <= endTime + dt; t += dt) {
		const u = -kp * (state[0] - ref) - kd * state[1] + kff * ref
		points.push({ t, position: state[0], velocity: state[1], control: u })
		state = stepRK4(p, ref, state, dt)
	}
	return points
}

/** Plant damping that yields the target closed-loop damping ratio, given the same m, k, gains. */
export function presetDamping(mode: 'under' | 'critical' | 'over', p: Omit<LabParams, 'c'>): number {
	const { m, k, kp, kd } = p
	const omegaN = Math.sqrt((k + kp) / m)
	const targetZeta = mode === 'under' ? 0.18 : mode === 'critical' ? 1.0 : 1.6
	const cEff = 2 * m * omegaN * targetZeta
	return clamp(cEff - kd, 0, Number.POSITIVE_INFINITY)
}

/** Time-domain metrics for one closed-loop step, all derived from a single simulation. */
export interface StepResponse {
	/** Peak overshoot as a percentage of the step size. */
	overshoot: number
	/** Time after which the response stays within the band, or null if it never does. */
	settle: number | null
	/** Integral of |x1 - r|, the tracking error the lab's objective weights most heavily. */
	iae: number
	/** Integral of u^2, the control effort the objective prices the other terms against. */
	effort: number
}

/**
 * Metrics for an already-sampled step. Integrals use the trapezoid rule over
 * the recorded samples, matching the lab's PerformanceAnalyzer.
 */
export function analyzeResponse(points: SamplePoint[], ref: number, bandPct = 5): StepResponse {
	let peak = -Infinity
	for (const pt of points) if (pt.position > peak) peak = pt.position
	const step = Math.abs(ref)
	const band = step * (bandPct / 100)

	let iae = 0
	let effort = 0
	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1]
		const cur = points[i]
		const dt = cur.t - prev.t
		iae += ((Math.abs(prev.position - ref) + Math.abs(cur.position - ref)) / 2) * dt
		effort += ((prev.control * prev.control + cur.control * cur.control) / 2) * dt
	}

	// Settling time is the last exit from the band. Scanning for the final
	// violation rather than walking backwards is what lets a response that never
	// enters the band report null instead of quietly reporting the horizon.
	let lastViolation = -1
	for (let i = 0; i < points.length; i++) {
		if (Math.abs(points[i].position - ref) > band) lastViolation = i
	}
	let settle: number | null
	if (lastViolation < 0) settle = points[0].t
	else if (lastViolation + 1 >= points.length) settle = null
	else settle = points[lastViolation + 1].t

	return { overshoot: step > 0 ? Math.max(0, ((peak - ref) / step) * 100) : 0, settle, iae, effort }
}

/** Simulate a step and measure it in one pass. */
export function stepResponse(
	p: LabParams,
	ref = 1,
	bandPct = 5,
	endTime = 8,
	dt = 0.005,
): StepResponse {
	return analyzeResponse(simulateClosedLoop(p, ref, [0, 0], endTime, dt), ref, bandPct)
}

/**
 * The lab's default objective weights: tracking error 1.0, control effort 0.1,
 * settling 0.5, overshoot 0.5, with the steady-state term disabled (state
 * feedback plus feedforward already tracks the reference exactly).
 */
export const OBJECTIVE_WEIGHTS = { iae: 1.0, effort: 0.1, settle: 0.5, overshoot: 0.5 } as const

/**
 * Weighted cost, mirroring the lab's objective: every term is divided by a
 * fixed positive scale derived from the problem (IAE by |r|·T, effort by
 * (k·|r|)²·T, settling by T, overshoot by 100) before weighting. The
 * normalization is what makes the default weights comparable, and the effort
 * term is what gives the search an interior optimum: on settling plus overshoot
 * alone the cost falls forever as Kp rises and the search just runs Kp to the
 * top of its range.
 *
 * A response that never settles is charged as settling at the horizon, the way
 * the lab penalizes a missing settling time.
 */
export function designCost(p: LabParams, r: StepResponse, ref: number, horizon: number): number {
	const rMag = Math.abs(ref) || 1
	const force = Math.abs(p.k * ref) || 1
	const w = OBJECTIVE_WEIGHTS
	return (
		w.iae * (r.iae / (rMag * horizon)) +
		w.effort * (r.effort / (force * force * horizon)) +
		w.settle * ((r.settle ?? horizon) / horizon) +
		w.overshoot * (r.overshoot / 100)
	)
}

/** Rectangular gain box, swept on a uniform grid. */
export interface GainBox {
	kpMax: number
	kdMax: number
	step: number
}

export interface SearchCell {
	kp: number
	kd: number
	cost: number
}

export interface SearchResult {
	/** Pairs in the box, including any skipped as unstable. */
	evaluated: number
	/** Pairs that were stable enough to score. */
	scored: number
	best: SearchCell | null
	cells: SearchCell[]
}

/**
 * Exhaustive sweep of a gain box, each candidate scored with the same
 * normalized weighted objective the lab's grid-search optimizer uses. Unstable
 * candidates are skipped rather than ranked, matching the lab's treatment of a
 * non-finite metric as infeasible.
 */
export function searchGains(
	plant: Omit<LabParams, 'kp' | 'kd'>,
	ref: number,
	box: GainBox,
	bandPct = 5,
	endTime = 6,
	dt = 0.01,
): SearchResult {
	const cells: SearchCell[] = []
	let evaluated = 0
	let best: SearchCell | null = null
	const n = Math.round(box.kpMax / box.step)
	const m = Math.round(box.kdMax / box.step)
	for (let i = 0; i <= n; i++) {
		for (let j = 0; j <= m; j++) {
			evaluated++
			const p: LabParams = { ...plant, kp: i * box.step, kd: j * box.step }
			if (!isStable(p)) continue
			const cost = designCost(p, stepResponse(p, ref, bandPct, endTime, dt), ref, endTime)
			const cell = { kp: p.kp, kd: p.kd, cost }
			cells.push(cell)
			if (best === null || cost < best.cost) best = cell
		}
	}
	return { evaluated, scored: cells.length, best, cells }
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))