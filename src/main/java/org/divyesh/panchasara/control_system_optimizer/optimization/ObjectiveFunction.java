package org.divyesh.panchasara.control_system_optimizer.optimization;

import org.divyesh.panchasara.control_system_optimizer.analysis.PerformanceMetrics;
import org.divyesh.panchasara.control_system_optimizer.simulation.Trajectory;

/**
 * Maps a simulated closed-loop response to a scalar cost. The objective is
 * fully replaceable without touching the optimizer.
 */
public interface ObjectiveFunction {

	/**
	 * @param trajectory the closed-loop trajectory
	 * @param metrics    performance metrics derived from the trajectory
	 * @return the cost; lower is better. Must never return NaN —
	 *         implementations should map undefined values to an explicit penalty.
	 */
	double evaluate(Trajectory trajectory, PerformanceMetrics metrics);

	/**
	 * Evaluates the cost with an optional analytic steady-state tracking error
	 * so objectives that include a steady-state term can normalize against it.
	 * Defaults to the plain evaluation when no steady-state value is available.
	 *
	 * @param steadyStateError the analytic steady-state tracking error magnitude,
	 *                         or {@code null} when undefined / not applicable
	 */
	default double evaluate(Trajectory trajectory, PerformanceMetrics metrics, Double steadyStateError) {
		return evaluate(trajectory, metrics);
	}
}