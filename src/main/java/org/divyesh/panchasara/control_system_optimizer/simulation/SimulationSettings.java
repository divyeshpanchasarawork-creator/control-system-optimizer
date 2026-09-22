package org.divyesh.panchasara.control_system_optimizer.simulation;

/**
 * Shared simulation configuration used by both simulation and optimization.
 *
 * @param initialState initial state vector
 * @param reference    reference state vector
 * @param startTime    simulation start time
 * @param endTime      simulation end time
 * @param timeStep     nominal fixed time step
 */
public record SimulationSettings(
		double[] initialState,
		double[] reference,
		double startTime,
		double endTime,
		double timeStep) {

	public SimulationSettings {
		if (initialState == null || reference == null) {
			throw new IllegalArgumentException("Initial state and reference must not be null");
		}
		if (initialState.length != reference.length) {
			throw new IllegalArgumentException("Initial state and reference must have equal dimensions");
		}
	}
}