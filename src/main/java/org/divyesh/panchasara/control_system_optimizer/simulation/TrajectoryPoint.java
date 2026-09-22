package org.divyesh.panchasara.control_system_optimizer.simulation;

/**
 * One recorded sample of a simulated trajectory.
 *
 * @param time      simulation time
 * @param state     state vector at this time
 * @param control   control input applied at this time
 * @param reference reference vector at this time
 */
public record TrajectoryPoint(double time, double[] state, double[] control, double[] reference) {
}