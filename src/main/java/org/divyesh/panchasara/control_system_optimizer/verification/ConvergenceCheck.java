package org.divyesh.panchasara.control_system_optimizer.verification;

/**
 * Time-step convergence result: how a metric drifts as the RK4 step shrinks.
 *
 * @param name               the compared metric
 * @param coarseValue        value at the coarse step (default app step)
 * @param fineValue          value at a much smaller step
 * @param absoluteDifference |coarse - fine|
 * @param relativeDifference absoluteDifference / |fine| (0 when fine is 0)
 * @param passed             true when within the configured tolerance
 */
public record ConvergenceCheck(
		String name,
		double coarseValue,
		double fineValue,
		double absoluteDifference,
		double relativeDifference,
		boolean passed) {
}