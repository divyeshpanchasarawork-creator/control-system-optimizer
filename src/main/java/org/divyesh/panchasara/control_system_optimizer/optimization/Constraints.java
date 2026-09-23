package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * Optional hard constraints on a candidate's closed-loop performance. A
 * candidate that violates any present constraint is infeasible. A {@code null}
 * field means that constraint is not enforced.
 *
 * @param maxControl       upper bound on max ||u(t)|| over the run
 * @param maxOvershoot     upper bound on percent overshoot
 * @param maxSettlingTime  latest allowed settling time in seconds; candidates
 *                         that never settle are always a violation
 */
public record Constraints(Double maxControl, Double maxOvershoot, Double maxSettlingTime) {

	public Constraints {
		if ((maxControl != null && !(maxControl > 0.0)) || (maxOvershoot != null && !(maxOvershoot > 0.0))
				|| (maxSettlingTime != null && !(maxSettlingTime > 0.0))) {
			throw new IllegalArgumentException("Constraint limits must be positive");
		}
	}

	public ConstraintReport check(double maxControlAchieved, double overshootAchieved, Double settlingTimeAchieved) {
		ControlLimit control = maxControl == null ? null
				: new ControlLimit("max-control", "Max control effort", maxControl, maxControlAchieved,
						maxControlAchieved <= maxControl);
		ControlLimit overshoot = maxOvershoot == null ? null
				: new ControlLimit("max-overshoot", "Max overshoot", maxOvershoot, overshootAchieved,
						overshootAchieved <= maxOvershoot);
		boolean settlingReached = Double.isFinite(settlingTimeAchieved);
		ControlLimit settling = maxSettlingTime == null ? null
				: new ControlLimit("max-settling-time", "Max settling time", maxSettlingTime,
						Double.isFinite(settlingTimeAchieved) ? settlingTimeAchieved : null,
						settlingReached && settlingTimeAchieved <= maxSettlingTime);
		return new ConstraintReport(control, overshoot, settling);
	}

	public record ControlLimit(String id, String name, double limit, Double achieved, boolean satisfied) {
	}

	public record ConstraintReport(ControlLimit maxControl, ControlLimit maxOvershoot, ControlLimit maxSettlingTime) {
	}
}