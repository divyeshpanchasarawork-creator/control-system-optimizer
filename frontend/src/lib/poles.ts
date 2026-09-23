export interface PoleSummary {
	zeta: number | null
	omegaN: number | null
	settlingEstimate: number | null
}

/**
 * Second-order descriptors derived from the closed-loop eigenvalues.
 * zeta and omegaN are defined when at least one complex pair is present;
 * otherwise they are null. The settling estimate follows the 2% rule of
 * thumb 4 / |Re(dominant)| where the dominant pole sits closest to the
 * imaginary axis (largest real part).
 */
export function poleSummary(eigenvalues: { real: number; imag: number }[]): PoleSummary | null {
	if (!eigenvalues || eigenvalues.length === 0) return null
	const finite = eigenvalues.filter((e) => Number.isFinite(e.real) && Number.isFinite(e.imag))
	if (finite.length === 0) return null

	const complex = finite.filter((e) => Math.abs(e.imag) > 1e-9)
	const dominantReal = Math.max(...finite.map((e) => e.real))
	const settlingEstimate = dominantReal < 0 ? 4 / Math.abs(dominantReal) : null

	if (complex.length >= 1) {
		const p = complex[0]
		const omegaN = Math.hypot(p.real, p.imag)
		const zeta = omegaN > 1e-12 ? -p.real / omegaN : 0
		return { zeta, omegaN, settlingEstimate }
	}
	return { zeta: null, omegaN: null, settlingEstimate }
}