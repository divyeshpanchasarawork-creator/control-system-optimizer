package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Optional hard constraints on the optimized closed-loop performance. Absent
 * fields are not enforced. Candidates that violate any present constraint are
 * treated as infeasible.
 *
 * @param maxControl      maximum allowed control effort max ||u(t)||
 * @param maxOvershoot    maximum allowed percent overshoot
 * @param maxSettlingTime latest allowed settling time (seconds)
 */
public record ConstraintSpec(
		Double maxControl,
		Double maxOvershoot,
		Double maxSettlingTime) {

	public ConstraintSpec {
		if ((maxControl != null && !(maxControl > 0.0)) || (maxOvershoot != null && !(maxOvershoot > 0.0))
				|| (maxSettlingTime != null && !(maxSettlingTime > 0.0))) {
			throw new IllegalArgumentException("Constraint limits must be positive");
		}
	}
}