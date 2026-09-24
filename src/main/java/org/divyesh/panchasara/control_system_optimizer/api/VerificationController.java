package org.divyesh.panchasara.control_system_optimizer.api;

import org.divyesh.panchasara.control_system_optimizer.verification.VerificationReport;
import org.divyesh.panchasara.control_system_optimizer.verification.VerificationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Runs the numerical-correctness harness: analytic golden cases, RK4 time-step
 * convergence, metric consistency across entry points and optimizer
 * cross-validation. The response carries the computed numbers so consumers can
 * paste them alongside the spec's expected values.
 */
@RestController
@RequestMapping("/api")
public class VerificationController {

	private final VerificationService verificationService;

	public VerificationController(VerificationService verificationService) {
		this.verificationService = verificationService;
	}

	@PostMapping("/verification/run")
	public VerificationReport run() {
		return verificationService.run();
	}
}