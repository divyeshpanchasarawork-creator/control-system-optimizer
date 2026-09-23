export interface LabParams {
	m: number
	k: number
	c: number
	kp: number
	kd: number
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

/** Derivative of the closed-loop state; u = -K(x - r). */
function derivative(p: LabParams, ref: number, state: [number, number]): [number, number] {
	const { m, k, c, kp, kd } = p
	const x1 = state[0]
	const x2 = state[1]
	const u = -kp * (x1 - ref) - kd * x2
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
	const { kp, kd } = p
	for (let t = 0; t <= endTime + dt; t += dt) {
		const u = -kp * (state[0] - ref) - kd * state[1]
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

/** Time (s) after which the response stays within band% of the reference. null if never. */
export function settleTime(p: LabParams, ref: number, bandPct = 5, endTime = 20): number | null {
	const band = Math.abs(ref) * (bandPct / 100)
	const points = simulateClosedLoop(p, ref, [0, 0], endTime)
	let settledAt: number | null = null
	for (let i = points.length - 1; i >= 0; i--) {
		if (Math.abs(points[i].position - ref) > band) {
			settledAt = points[i].t
			break
		}
		if (Math.abs(points[i].position - ref) <= band) settledAt = points[i].t
	}
	return settledAt
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))