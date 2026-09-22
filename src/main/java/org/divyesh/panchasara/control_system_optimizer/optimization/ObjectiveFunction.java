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
}