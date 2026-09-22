package org.divyesh.panchasara.control_system_optimizer.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record OptimizationRequest(
		@NotNull @Valid SystemSpec system,
		@NotNull @Valid ControllerSpec controller,
		@NotNull @Valid GainBounds gainBounds,
		@NotNull @Valid OptimizerSpec optimizer,
		@NotNull @Valid ObjectiveSpec objective,
		@NotNull @Valid SimulationConfig simulation) {
}