package org.divyesh.panchasara.control_system_optimizer.api;

import jakarta.validation.Valid;
import org.divyesh.panchasara.control_system_optimizer.api.dto.OptimizationRequest;
import org.divyesh.panchasara.control_system_optimizer.api.dto.OptimizationResponse;
import org.divyesh.panchasara.control_system_optimizer.service.OptimizationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class OptimizationController {

	private final OptimizationService optimizationService;

	public OptimizationController(OptimizationService optimizationService) {
		this.optimizationService = optimizationService;
	}

	@PostMapping("/optimization")
	public OptimizationResponse optimize(@Valid @RequestBody OptimizationRequest request) {
		return optimizationService.optimize(request);
	}
}