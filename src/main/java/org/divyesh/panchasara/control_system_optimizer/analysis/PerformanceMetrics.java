package org.divyesh.panchasara.control_system_optimizer.analysis;

/**
 * Performance metrics derived from a simulated trajectory.
 *
 * Exact definitions (all integrals are trapezoidal over the discrete samples):
 *
 * <ul>
 *   <li>{@code finalError} = |x(T) - r(T)|</li>
 *   <li>{@code maxAbsError} = max_t |x(t) - r(t)|</li>
 *   <li>{@code iae} = integral of |x(t) - r(t)| dt</li>
 *   <li>{@code ise} = integral of |x(t) - r(t)|^2 dt</li>
 *   <li>{@code overshoot} percentage: (peak - r0)/|r0| * 100 clamped to >= 0 for
 *       non-zero reference; 0.0 for a zero reference (see performance analyzer)</li>
 *   <li>{@code settlingTime}: first time t after which the error stays within a
 *       2% band of the reference norm forever; NaN if it never settles</li>
 *   <li>{@code controlEffort} = integral of u(t)^T u(t) dt</li>
 *   <li>{@code maxControl} = max_t ||u(t)||_2</li>
 * </ul>
 *
 * Note that {@code settlingTime} is deliberately a {@link Double#NaN} when the
 * system never settles — that is a legitimate (undesirable) outcome, not a
 * numerical failure. The remaining metrics are NaN only when a trajectory
 * contains non-finite values.
 */
public record PerformanceMetrics(
		double finalError,
		double maxAbsError,
		double iae,
		double ise,
		double overshoot,
		double settlingTime,
		double controlEffort,
		double maxControl) {

	/** True if any of the error/effort metrics is NaN (numerically invalid). */
	public boolean hasInvalidNumerics() {
		return !Double.isFinite(finalError) || !Double.isFinite(maxAbsError) || !Double.isFinite(iae)
				|| !Double.isFinite(ise) || !Double.isFinite(overshoot)
				|| !Double.isFinite(controlEffort) || !Double.isFinite(maxControl);
	}
}