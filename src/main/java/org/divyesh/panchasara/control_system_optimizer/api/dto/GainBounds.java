package org.divyesh.panchasara.control_system_optimizer.api.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Bounded box for the controller gain search space.
 */
public record GainBounds(
		@NotNull double[] lower,
		@NotNull double[] upper) {

	public GainBounds {
		if (lower == null || upper == null) {
			throw new IllegalArgumentException("Gain bounds must both be present");
		}
		if (lower.length != upper.length || lower.length == 0) {
			throw new IllegalArgumentException("Gain bounds must be non-empty and equally sized");
		}
		for (int i = 0; i < lower.length; i++) {
			if (!(lower[i] < upper[i])) {
				throw new IllegalArgumentException("Every gain lower bound must be strictly below its upper bound");
			}
		}
	}
}