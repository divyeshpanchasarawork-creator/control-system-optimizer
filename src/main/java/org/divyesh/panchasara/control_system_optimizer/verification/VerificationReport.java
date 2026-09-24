package org.divyesh.panchasara.control_system_optimizer.verification;

import java.util.List;

/**
 * The full outcome of a verification run: analytic golden cases, time-step
 * convergence, metric consistency and optimizer cross-validation.
 *
 * @param status           "PASS" when every individual check passed, else "FAIL"
 * @param goldenCases      the three golden configurations
 * @param convergence      dt sensitivity for golden-2
 * @param consistency      simulation vs. optimizer evaluation for golden-2
 * @param crossValidation  optimizer agreement for golden-2
 * @param elapsedMillis    wall time of the run
 */
public record VerificationReport(
		String status,
		List<GoldenCaseResult> goldenCases,
		List<ConvergenceCheck> convergence,
		List<ConsistencyCheck> consistency,
		List<CrossValidationCheck> crossValidation,
		long elapsedMillis) {

	public VerificationReport {
		goldenCases = goldenCases == null ? List.of() : List.copyOf(goldenCases);
		convergence = convergence == null ? List.of() : List.copyOf(convergence);
		consistency = consistency == null ? List.of() : List.copyOf(consistency);
		crossValidation = crossValidation == null ? List.of() : List.copyOf(crossValidation);
	}
}