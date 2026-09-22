package org.divyesh.panchasara.control_system_optimizer.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Shared simulation configuration block for both simulation and optimization
 * requests. Nullables fall back to framework defaults.
 */
public record SimulationConfig(
		@NotNull double[] initialState,
		@NotNull double[] reference,
		Double startTime,
		Double endTime,
		Double timeStep) {
}