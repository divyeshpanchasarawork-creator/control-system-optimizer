package org.divyesh.panchasara.control_system_optimizer.verification;

/**
 * Result of verifying one golden configuration: the closed-form analytic
 * values side-by-side with what the actual pipeline produced (eigenvalues,
 * RK4 simulation and performance metrics).
 *
 * @param id, name, m, c, k, gains  the configuration under test
 * @param poleRe, poleIm            analytic closed-loop pole (dominant pair)
 * @param omegaN, zeta              analytic natural frequency and damping ratio
 * @param settlingEstimateSeconds   analytic 2% settling estimate 4/|Re(dominant)|
 * @param idealPosition             x_ss = Kp/(k+Kp) * r
 * @param steadyStateError          e_ss = k/(k+Kp) * r
 * @param analyticControlAtZero     u(0) = Kp * r
 * @param analyzerStable            stability verdict of the shared analyzer
 * @param simulated...              RK4 metrics at dt
 * @param settlingTwoPercent        measured settling at 2%, null if never settled
 * @param measuredControlAtZero     recorded u(t=0) from the trajectory
 * @param passed                    true when every check is within tolerance
 */
public record GoldenCaseResult(
		String id,
		String name,
		double m,
		double c,
		double k,
		double[] gains,
		double poleRe,
		double poleIm,
		double omegaN,
		double zeta,
		Double settlingEstimateSeconds,
		double idealPosition,
		double steadyStateError,
		double analyticControlAtZero,
		boolean analyzerStable,
		double simulatedFinalError,
		double simulatedMaxAbsError,
		double simulatedIae,
		double simulatedIse,
		double simulatedOvershoot,
		double simulatedControlEffort,
		double simulatedMaxControl,
		Double settlingTwoPercent,
		double measuredControlAtZero,
		boolean passed) {
}