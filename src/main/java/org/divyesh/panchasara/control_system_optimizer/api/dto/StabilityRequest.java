package org.divyesh.panchasara.control_system_optimizer.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record StabilityRequest(
		@NotNull @Valid SystemSpec system,
		@NotNull @Valid ControllerSpec controller) {
}