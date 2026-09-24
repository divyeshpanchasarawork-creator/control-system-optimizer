package org.divyesh.panchasara.control_system_optimizer.verification;

/**
 * A spring-damper configuration with closed-form reference values, used to
 * verify the whole pipeline (state-space assembly, closed loop, stability,
 * RK4 simulation and metrics) against analytic results.
 *
 * @param id     short stable identifier
 * @param name   human-readable description
 * @param m      mass in kg
 * @param c      damping coefficient in N s/m
 * @param k      spring constant in N/m
 * @param gains  proportional and derivative gains [Kp, Kd]
 */
public record GoldenCase(String id, String name, double m, double c, double k, double[] gains) {

	/** The three golden configurations from the numerical-correctness spec. */
	public static final GoldenCase[] CASES = {
			new GoldenCase("golden-1", "Open-loop spring-damper", 1.0, 0.5, 2.0, new double[] { 0.0, 0.0 }),
			new GoldenCase("golden-2", "Tracking with K=[10,5]", 1.0, 0.5, 2.0, new double[] { 10.0, 5.0 }),
			new GoldenCase("golden-3", "Heavier plant with Kp=8.8889 Kd=14.1414", 5.0, 2.0, 10.0,
					new double[] { 8.8888888888889, 14.141414141414 } ),
	};

	public double kp() {
		return gains[0];
	}

	public double kd() {
		return gains[1];
	}
}