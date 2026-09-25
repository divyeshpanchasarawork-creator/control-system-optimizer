package org.divyesh.panchasara.control_system_optimizer.api.dto;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveBreakdown;
import org.divyesh.panchasara.control_system_optimizer.optimization.ObjectiveTerm;

/**
 * JSON projection of the objective breakdown. Each metric exposes its raw value,
 * its normalization reference, the normalized ratio, the weight and the weighted
 * contribution, so a consumer can reproduce J and its per-term shares.
 */
public record ObjectiveBreakdownResponse(
		boolean normalized,
		double total,
		List<ObjectiveTermResponse> terms) {

	public static ObjectiveBreakdownResponse from(ObjectiveBreakdown b) {
		List<ObjectiveTermResponse> terms = new java.util.ArrayList<>(5);
		terms.add(ObjectiveTermResponse.of("trackingError", "Tracking error", b.trackingError(), b.total()));
		terms.add(ObjectiveTermResponse.of("controlEffort", "Control energy", b.controlEffort(), b.total()));
		terms.add(ObjectiveTermResponse.of("settlingTime", "Settling time", b.settlingTime(), b.total()));
		terms.add(ObjectiveTermResponse.of("overshoot", "Overshoot", b.overshoot(), b.total()));
		if (b.steadyStateError() != null) {
			terms.add(ObjectiveTermResponse.of("steadyStateError", "Steady-state error", b.steadyStateError(), b.total()));
		}
		return new ObjectiveBreakdownResponse(b.normalized(), b.total(), terms);
	}

	public record ObjectiveTermResponse(
			String key,
			String name,
			double raw,
			double reference,
			double normalized,
			double weight,
			double contribution,
			double sharePercent) {

		static ObjectiveTermResponse of(String key, String name, ObjectiveTerm term, double total) {
			double share = total > 0.0 ? term.contribution() / total * 100.0 : 0.0;
			return new ObjectiveTermResponse(key, name, term.raw(), term.reference(), term.normalized(),
					term.weight(), term.contribution(), share);
		}
	}
}