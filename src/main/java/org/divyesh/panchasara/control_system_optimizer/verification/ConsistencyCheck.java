package org.divyesh.panchasara.control_system_optimizer.verification;

/**
 * Metric-consistency result: the same gain must produce identical metrics no
 * matter which entry point evaluates it (direct simulation vs. the
 * closed-loop evaluation used to score optimization candidates).
 *
 * @param name              the compared metric
 * @param directSimulation  value from {@code simulator + analyzer}
 * @param closedLoop        value from the candidate evaluation path
 * @param passed            true when the two agree within tolerance
 */
public record ConsistencyCheck(
		String name,
		double directSimulation,
		double closedLoop,
		boolean passed) {
}