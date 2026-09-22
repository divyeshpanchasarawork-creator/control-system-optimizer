package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.model.SystemType;

public record SimulationResponse(
		SystemType systemType,
		java.util.Map<String, Double> systemParameters,
		ControllerSpec controller,
		MetricsResponse metrics,
		List<TrajectoryPointDto> trajectory) {
}