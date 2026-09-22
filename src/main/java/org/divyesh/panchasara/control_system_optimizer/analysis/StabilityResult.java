package org.divyesh.panchasara.control_system_optimizer.analysis;

import java.util.List;

/**
 * Outcome of a linear stability analysis.
 *
 * @param stable     true if every eigenvalue of the closed-loop system has a
 *                   strictly negative real part (asymptotic stability)
 * @param maxRealPart largest real part among the eigenvalues
 * @param minRealPart smallest real part among the eigenvalues
 * @param eigenvalues eigenvalues of the analyzed matrix
 */
public record StabilityResult(
		boolean stable,
		double maxRealPart,
		double minRealPart,
		List<ComplexValue> eigenvalues) {
}