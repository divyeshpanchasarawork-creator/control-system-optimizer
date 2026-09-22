package org.divyesh.panchasara.control_system_optimizer.api.dto;

/**
 * Objective weights for {@code WeightedControlObjective}. Missing weights fall
 * back to 1.0 / 0.1 / 0.5 / 0.5.
 */
public record ObjectiveSpec(
		Double trackingErrorWeight,
		Double controlEffortWeight,
		Double settlingTimeWeight,
		Double overshootWeight) {
}