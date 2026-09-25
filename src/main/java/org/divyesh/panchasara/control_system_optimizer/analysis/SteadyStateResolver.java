package org.divyesh.panchasara.control_system_optimizer.analysis;

/**
 * Analytical steady-state tracking analysis for the mass-spring-damper plant
 * {@code m*x'' + c*x' + k*x = u} under state feedback.
 *
 * <p>Without feedforward the PD law {@code u = -Kp*(x1 - r1) - Kd*(x2 - r2)}
 * cannot cancel the spring's static load, so the position settles at
 *
 * <pre>
 *   x_ss = Kp * r1 / (k + Kp)
 *   e_ss = r1 - x_ss = k * r1 / (k + Kp)
 * </pre>
 *
 * (valid for a constant reference with zero reference velocity and an
 * unsaturated, stable closed loop). With reference feedforward
 * {@code u = -K(x - r) + k*r1} the steady state is exact: {@code x_ss = r1}
 * and {@code e_ss = 0}. When the reference is not trackable (regulation to the
 * origin, or {@code k + Kp == 0}) the values are undefined.
 */
public final class SteadyStateResolver {

	private SteadyStateResolver() {
	}

	/**
	 * @return the analytic steady state for the given gains, or {@code null}
	 *         when it is undefined (open loop, non-tracking, or {@code k + Kp == 0})
	 */
	public static SteadyState resolve(double[] gains, double springConstant, double referencePosition,
			boolean tracking, boolean feedforward) {
		if (!tracking || gains == null || gains.length == 0) {
			return SteadyState.undefined();
		}
		if (feedforward) {
			return Double.isFinite(referencePosition) ? SteadyState.perfect(referencePosition) : SteadyState.undefined();
		}
		double denominator = springConstant + gains[0];
		if (!Double.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
			return SteadyState.undefined();
		}
		double xSS = gains[0] * referencePosition / denominator;
		return new SteadyState(xSS, Math.abs(referencePosition - xSS));
	}
}