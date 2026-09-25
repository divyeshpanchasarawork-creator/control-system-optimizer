package org.divyesh.panchasara.control_system_optimizer.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Shared simulation configuration block for both simulation and optimization
 * requests. Nullables fall back to framework defaults.
 *
 * @param settlingBand settling-time tolerance band as a percentage of the
 *                     reference norm, e.g. 2, 5 or 10 (default 2)
 */
public record SimulationConfig(
		@NotNull double[] initialState,
		@NotNull double[] reference,
		Double startTime,
		Double endTime,
		Double timeStep,
		Double settlingBand,
		Double saturation) {

	public SimulationConfig {
		if (settlingBand != null && (settlingBand <= 0.0 || settlingBand > 100.0)) {
			throw new IllegalArgumentException("settlingBand must be in (0, 100] (percent)");
		}
		if (saturation != null && !(saturation > 0.0)) {
			throw new IllegalArgumentException("saturation must be a positive force limit or null (disabled)");
		}
	}
}