package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Optional hard constraints on the optimized closed-loop performance. Absent
 * fields are not enforced. Candidates that violate any present constraint are
 * treated as infeasible.
 *
 * @param maxControl          maximum allowed control effort max ||u(t)|| (peak force)
 * @param maxOvershoot        maximum allowed percent overshoot
 * @param maxSettlingTime     latest allowed settling time (seconds)
 * @param maxSteadyStateError maximum allowed analytic steady-state tracking error
 * @param maxControlEnergy    maximum allowed control energy integral u(t)^T u(t) dt
 */
public record ConstraintSpec(
		Double maxControl,
		Double maxOvershoot,
		Double maxSettlingTime,
		Double maxSteadyStateError,
		Double maxControlEnergy) {

	public ConstraintSpec(Double maxControl, Double maxOvershoot, Double maxSettlingTime) {
		this(maxControl, maxOvershoot, maxSettlingTime, null, null);
	}

	public ConstraintSpec {
		if ((maxControl != null && !(maxControl > 0.0)) || (maxOvershoot != null && !(maxOvershoot > 0.0))
				|| (maxSettlingTime != null && !(maxSettlingTime > 0.0))
				|| (maxSteadyStateError != null && !(maxSteadyStateError > 0.0))
				|| (maxControlEnergy != null && !(maxControlEnergy > 0.0))) {
			throw new IllegalArgumentException("Constraint limits must be positive");
		}
	}
}