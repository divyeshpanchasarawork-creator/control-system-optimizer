package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.analysis.ComplexValue;

public record StabilityResponse(
		boolean stable,
		double maxRealPart,
		double minRealPart,
		List<ComplexValue> eigenvalues) {
}