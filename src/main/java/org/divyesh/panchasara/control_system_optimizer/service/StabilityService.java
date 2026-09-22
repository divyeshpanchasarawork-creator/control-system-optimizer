package org.divyesh.panchasara.control_system_optimizer.service;

import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityAnalyzer;
import org.divyesh.panchasara.control_system_optimizer.analysis.StabilityResult;
import org.divyesh.panchasara.control_system_optimizer.api.dto.StabilityRequest;
import org.divyesh.panchasara.control_system_optimizer.api.dto.StabilityResponse;
import org.divyesh.panchasara.control_system_optimizer.control.ClosedLoopSystem;
import org.divyesh.panchasara.control_system_optimizer.control.Controller;
import org.divyesh.panchasara.control_system_optimizer.control.StateFeedbackController;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.systems.SystemRegistry;
import org.springframework.stereotype.Service;

/**
 * Computes the eigenvalues and stability verdict of the closed-loop system
 * A_cl = A - B*K.
 */
@Service
public class StabilityService {

	private final SystemRegistry registry;
	private final StabilityAnalyzer stabilityAnalyzer;
	private final SimulationService simulationService;

	public StabilityService(SystemRegistry registry, StabilityAnalyzer stabilityAnalyzer,
			SimulationService simulationService) {
		this.registry = registry;
		this.stabilityAnalyzer = stabilityAnalyzer;
		this.simulationService = simulationService;
	}

	public StabilityResponse analyze(StabilityRequest request) {
		DynamicSystem system = registry.create(request.system().type(), request.system().parameters());
		Controller controller = simulationService.buildController(request.controller(), system.dimension());
		if (!(controller instanceof StateFeedbackController stateFeedback)) {
			throw new IllegalArgumentException("Stability analysis currently requires a STATE_FEEDBACK controller");
		}
		StabilityResult result = stabilityAnalyzer.analyze(ClosedLoopSystem.of(system, stateFeedback).acl());
		return new StabilityResponse(result.stable(), result.maxRealPart(), result.minRealPart(), result.eigenvalues());
	}
}