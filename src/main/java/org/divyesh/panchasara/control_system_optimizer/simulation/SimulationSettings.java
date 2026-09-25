package org.divyesh.panchasara.control_system_optimizer.simulation;

/**
 * Shared simulation configuration used by both simulation and optimization.
 *
 * @param initialState       initial state vector
 * @param reference          reference state vector
 * @param startTime          simulation start time
 * @param endTime            simulation end time
 * @param timeStep           nominal fixed time step
 * @param settlingBandFraction settling tolerance as a fraction of the reference
 *                            norm (0.02 = 2%); the smaller the fraction the
 *                            stricter the definition of "settled"
 */
public record SimulationSettings(
		double[] initialState,
		double[] reference,
		double startTime,
		double endTime,
		double timeStep,
		double settlingBandFraction,
		double saturation) {

	public SimulationSettings {
		if (initialState == null || reference == null) {
			throw new IllegalArgumentException("Initial state and reference must not be null");
		}
		if (initialState.length != reference.length) {
			throw new IllegalArgumentException("Initial state and reference must have equal dimensions");
		}
		settlingBandFraction = Double.isFinite(settlingBandFraction) && settlingBandFraction > 0.0
				? settlingBandFraction
				: 0.02;
		saturation = Double.isFinite(saturation) && saturation > 0.0 ? saturation : 0.0;
	}

	public SimulationSettings(double[] initialState, double[] reference, double startTime, double endTime,
			double timeStep, double settlingBandFraction) {
		this(initialState, reference, startTime, endTime, timeStep, settlingBandFraction, 0.0);
	}

	public SimulationSettings(double[] initialState, double[] reference, double startTime, double endTime,
			double timeStep) {
		this(initialState, reference, startTime, endTime, timeStep, 0.02, 0.0);
	}
}