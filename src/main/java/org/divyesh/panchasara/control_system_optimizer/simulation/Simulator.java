package org.divyesh.panchasara.control_system_optimizer.simulation;

/**
 * Numerical integrator abstraction. Implementations are responsible for
 * discretizing a {@link SimulationSetup} into a {@link Trajectory}.
 */
public interface Simulator {

	/**
	 * Integrates the closed-loop system from the initial state over the configured
	 * time interval.
	 *
	 * @param setup fully-specified simulation inputs
	 * @return the sampled trajectory
	 */
	Trajectory simulate(SimulationSetup setup);
}