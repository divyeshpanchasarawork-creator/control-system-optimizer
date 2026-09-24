package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * One term of the objective breakdown for a single metric.
 *
 * @param raw          the raw metric value (IAE, U, Ts or O)
 * @param reference    the normalization reference for that metric (1.0 when unnormalized)
 * @param normalized   {@code raw / reference}
 * @param weight       the user weight w_i for that metric
 * @param contribution the weighted contribution {@code weight * normalized} that
 *                     feeds into the objective total
 */
public record ObjectiveTerm(
		double raw,
		double reference,
		double normalized,
		double weight,
		double contribution) {
}