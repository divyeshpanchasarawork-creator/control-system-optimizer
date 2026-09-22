package org.divyesh.panchasara.control_system_optimizer.api.dto;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;

/**
 * JSON-safe projection of {@link PerformanceMetrics}. Non-finite values are
 * mapped to {@code null} so that responses never emit NaN/Infinity in JSON.
 */
public record MetricsResponse(
		double finalError,
		double maxAbsError,
		double iae,
		double ise,
		double overshoot,
		Double settlingTime,
		double controlEffort,
		double maxControl) {

	public static MetricsResponse from(PerformanceMetrics m) {
		return new MetricsResponse(
				m.finalError(),
				m.maxAbsError(),
				m.iae(),
				m.ise(),
				m.overshoot(),
				Double.isFinite(m.settlingTime()) ? m.settlingTime() : null,
				m.controlEffort(),
				m.maxControl());
	}
}