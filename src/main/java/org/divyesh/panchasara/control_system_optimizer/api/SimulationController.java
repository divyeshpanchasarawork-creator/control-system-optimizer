package org.divyesh.panchasara.control_system_optimizer.api;

import jakarta.validation.Valid;
import org.divyesh.panchasara.control_system_optimizer.api.dto.SimulationRequest;
import org.divyesh.panchasara.control_system_optimizer.api.dto.SimulationResponse;
import org.divyesh.panchasara.control_system_optimizer.service.SimulationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SimulationController {

	private final SimulationService simulationService;

	public SimulationController(SimulationService simulationService) {
		this.simulationService = simulationService;
	}

	@PostMapping("/simulations")
	public SimulationResponse simulate(@Valid @RequestBody SimulationRequest request) {
		return simulationService.simulate(request);
	}
}