package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * The four weighted contributions that sum to the objective cost J, plus their
 * total. Lets a UI show *why* one gain beats another.
 */
public record ObjectiveBreakdown(
		double trackingError,
		double controlEffort,
		double settlingTime,
		double overshoot,
		double total) {
}