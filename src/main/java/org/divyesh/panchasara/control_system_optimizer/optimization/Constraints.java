package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Optional hard constraints on a candidate's closed-loop performance. A
 * candidate that violates any present constraint is infeasible. A {@code null}
 * field means that constraint is not enforced.
 *
 * <p>Satisfaction uses a small relative tolerance ({@code achieved <= limit * (1 + TOL)})
 * so floating-point rounding at a limit never flips a verdict.
 *
 * @param maxControl          upper bound on max ||u(t)|| (peak force)
 * @param maxOvershoot        upper bound on percent overshoot
 * @param maxSettlingTime     latest allowed settling time in seconds; candidates
 *                            that never settle are always a violation
 * @param maxSteadyStateError upper bound on the analytic steady-state tracking
 *                            error; undefined (non-tracking) is treated as not applicable
 * @param maxControlEnergy    upper bound on control energy U = integral u(t)^T u(t) dt
 */
public record Constraints(Double maxControl, Double maxOvershoot, Double maxSettlingTime, Double maxSteadyStateError,
		Double maxControlEnergy) {

	/** Relative slack applied to every constraint comparison. */
	public static final double RELATIVE_TOLERANCE = 1e-12;

	public Constraints {
		if ((maxControl != null && !(maxControl > 0.0)) || (maxOvershoot != null && !(maxOvershoot > 0.0))
				|| (maxSettlingTime != null && !(maxSettlingTime > 0.0))
				|| (maxSteadyStateError != null && !(maxSteadyStateError > 0.0))
				|| (maxControlEnergy != null && !(maxControlEnergy > 0.0))) {
			throw new IllegalArgumentException("Constraint limits must be positive");
		}
	}

	public Constraints(Double maxControl, Double maxOvershoot, Double maxSettlingTime) {
		this(maxControl, maxOvershoot, maxSettlingTime, null, null);
	}

	/**
	 * @param steadyStateErrorAchieved analytic steady-state error magnitude, or
	 *                                 {@code null} when not applicable (non-tracking)
	 */
	public ConstraintReport check(double maxControlAchieved, double overshootAchieved, Double settlingTimeAchieved,
			double controlEffortAchieved, Double steadyStateErrorAchieved) {
		ControlLimit control = maxControl == null ? null
				: new ControlLimit("max-control", "Peak force", maxControl, maxControlAchieved,
						within(maxControlAchieved, maxControl));
		ControlLimit overshoot = maxOvershoot == null ? null
				: new ControlLimit("max-overshoot", "Max overshoot", maxOvershoot, overshootAchieved,
						within(overshootAchieved, maxOvershoot));
		boolean settlingReached = settlingTimeAchieved != null && Double.isFinite(settlingTimeAchieved);
		ControlLimit settling = maxSettlingTime == null ? null
				: new ControlLimit("max-settling-time", "Max settling time", maxSettlingTime,
						settlingReached ? settlingTimeAchieved : null,
						settlingReached && within(settlingTimeAchieved, maxSettlingTime));
		ControlLimit energy = maxControlEnergy == null ? null
				: new ControlLimit("max-control-energy", "Control energy", maxControlEnergy, controlEffortAchieved,
						within(controlEffortAchieved, maxControlEnergy));
		boolean steadyStateApplicable = steadyStateErrorAchieved != null && Double.isFinite(steadyStateErrorAchieved);
		ControlLimit steadyState = maxSteadyStateError == null ? null
				: new ControlLimit("max-steady-state-error", "Steady-state error", maxSteadyStateError,
						steadyStateApplicable ? steadyStateErrorAchieved : null,
						!steadyStateApplicable || within(steadyStateErrorAchieved, maxSteadyStateError));
		return new ConstraintReport(control, overshoot, settling, steadyState, energy);
	}

	/** {@code achieved <= limit * (1 + TOL)} with non-finite achieved always a violation. */
	private static boolean within(double achieved, double limit) {
		return Double.isFinite(achieved) && achieved <= limit * (1.0 + RELATIVE_TOLERANCE);
	}

	public record ControlLimit(String id, String name, double limit, Double achieved, boolean satisfied) {
	}

	public record ConstraintReport(ControlLimit maxControl, ControlLimit maxOvershoot, ControlLimit maxSettlingTime,
			ControlLimit maxSteadyStateError, ControlLimit maxControlEnergy) {
	}
}