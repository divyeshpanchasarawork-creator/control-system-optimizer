package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Objective weights for {@code WeightedControlObjective}. Missing weights fall
 * back to 1.0 / 0.1 / 0.5 / 0.5 with the optional steady-state-error term
 * disabled. When {@code steadyStateErrorWeight} is present it must be
 * non-negative, and {@code steadyStateErrorScale} is the fixed positive
 * normalization scale for that term (defaults to the reference magnitude).
 */
public record ObjectiveSpec(
		Double trackingErrorWeight,
		Double controlEffortWeight,
		Double settlingTimeWeight,
		Double overshootWeight,
		Double steadyStateErrorWeight,
		Double steadyStateErrorScale) {

	public ObjectiveSpec {
		if (steadyStateErrorWeight != null && !(steadyStateErrorWeight >= 0.0)) {
			throw new IllegalArgumentException("steadyStateErrorWeight must be non-negative when present");
		}
		if (steadyStateErrorScale != null && !(steadyStateErrorScale > 0.0)) {
			throw new IllegalArgumentException("steadyStateErrorScale must be a positive number when present");
		}
	}
}