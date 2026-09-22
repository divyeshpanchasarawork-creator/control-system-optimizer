package org.divyesh.panchasara.control_system_optimizer.api;

import jakarta.validation.Valid;
import org.divyesh.panchasara.control_system_optimizer.api.dto.StabilityRequest;
import org.divyesh.panchasara.control_system_optimizer.api.dto.StabilityResponse;
import org.divyesh.panchasara.control_system_optimizer.service.StabilityService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class StabilityController {

	private final StabilityService stabilityService;

	public StabilityController(StabilityService stabilityService) {
		this.stabilityService = stabilityService;
	}

	@PostMapping("/analysis/stability")
	public StabilityResponse analyze(@Valid @RequestBody StabilityRequest request) {
		return stabilityService.analyze(request);
	}
}