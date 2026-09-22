package org.divyesh.panchasara.control_system_optimizer.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record SimulationRequest(
		@NotNull @Valid SystemSpec system,
		@Valid ControllerSpec controller,
		@NotNull @Valid SimulationConfig simulation) {
}