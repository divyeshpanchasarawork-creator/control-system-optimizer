package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;

/**
 * The closest infeasible candidate an optimization run evaluated, present only
 * when no feasible gain was found. It exists so a failed run can say what it came
 * nearest to, and which limits stood in the way, instead of reporting only that
 * it failed.
 *
 * <p>These are the metrics of a <em>rejected</em> candidate: they are not a
 * solution, and {@code gain} is deliberately not published as
 * {@link OptimizationResponse#bestGain()} nor considered for "apply".
 *
 * @param gain                 the rejected parameter vector
 * @param metrics              what that candidate achieved (null if it never
 *                             produced a usable response, e.g. it destabilized)
 * @param violatedConstraints  only the enforced limits that candidate failed, in
 *                             declaration order; empty when it responded but
 *                             missed no measured limit
 */
public record NearestMissResponse(
		double[] gain,
		MetricsResponse metrics,
		List<ConstraintReportResponse> violatedConstraints) {

	public NearestMissResponse {
		violatedConstraints = violatedConstraints == null ? List.of() : List.copyOf(violatedConstraints);
	}
}
