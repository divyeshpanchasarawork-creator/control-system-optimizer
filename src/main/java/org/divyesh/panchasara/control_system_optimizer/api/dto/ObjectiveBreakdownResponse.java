package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * The four weighted contributions that sum to the objective cost plus their
 * total. Mirrors {@code WeightedControlObjective.breakdown} for API consumers.
 */
public record ObjectiveBreakdownResponse(
		double trackingError,
		double controlEffort,
		double settlingTime,
		double overshoot,
		double total) {

	public static ObjectiveBreakdownResponse from(
			org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveBreakdown b) {
		return new ObjectiveBreakdownResponse(b.trackingError(), b.controlEffort(), b.settlingTime(), b.overshoot(),
				b.total());
	}
}