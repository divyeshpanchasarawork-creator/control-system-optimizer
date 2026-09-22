package org.divyesh.panchasara.control_system_optimizer.simulation;

import org.divyesh.panchasara.control_system_optimizer.control.Controller;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;

/**
 * Immutable description of everything needed to run one simulation.
 *
 * @param system      the dynamic system to simulate
 * @param controller  the closed-loop controller; may be {@code null} for an
 *                    open-loop simulation with zero control input
 * @param initialState initial state vector
 * @param reference   reference state vector
 * @param startTime   simulation start time
 * @param endTime     simulation end time
 * @param timeStep    nominal fixed time step (the last step may be shorter)
 */
public record SimulationSetup(
		DynamicSystem system,
		Controller controller,
		double[] initialState,
		double[] reference,
		double startTime,
		double endTime,
		double timeStep) {

	public SimulationSetup {
		if (system == null) {
			throw new IllegalArgumentException("System must not be null");
		}
		if (initialState == null || initialState.length != system.dimension()) {
			throw new IllegalArgumentException("Initial state must have dimension " + system.dimension());
		}
		if (reference == null || reference.length != system.dimension()) {
			throw new IllegalArgumentException("Reference must have dimension " + system.dimension());
		}
		if (!(timeStep > 0.0) || Double.isNaN(timeStep) || Double.isInfinite(timeStep)) {
			throw new IllegalArgumentException("Time step must be a finite positive number");
		}
		if (!(endTime > startTime) || Double.isNaN(startTime) || Double.isNaN(endTime)) {
			throw new IllegalArgumentException("Simulation interval must be finite with endTime > startTime");
		}
	}
}