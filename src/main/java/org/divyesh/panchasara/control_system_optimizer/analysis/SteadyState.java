package org.divyesh.panchasara.control_system_optimizer.analysis;

/**
 * Analytic steady state of a tracking closed loop.
 *
 * @param xSS steady-state position (may be {@code null} when undefined)
 * @param eSS steady-state tracking error magnitude |r1 - x_ss|, never
 *            negative (may be {@code null} when undefined)
 */
public record SteadyState(Double xSS, Double eSS) {

	/** The steady state of a loop that converges exactly onto the reference. */
	public static SteadyState perfect(double referencePosition) {
		return new SteadyState(referencePosition, 0.0);
	}

	/** Steady state whose values are undefined (open loop / non-tracking). */
	public static SteadyState undefined() {
		return new SteadyState(null, null);
	}
}