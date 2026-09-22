package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.Map;

import jakarta.validation.constraints.NotNull;
import org.divyesh.panchasara.control_system_optimizer.model.SystemType;

/**
 * Identifies a physical system type together with its numeric parameters.
 */
public record SystemSpec(
		@NotNull SystemType type,
		@NotNull Map<String, Double> parameters) {

	public SystemSpec {
		parameters = parameters == null ? Map.of() : Map.copyOf(parameters);
	}
}