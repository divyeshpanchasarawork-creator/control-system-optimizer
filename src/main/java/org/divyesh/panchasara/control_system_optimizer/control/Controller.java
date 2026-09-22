package org.divyesh.panchasara.control_system_optimizer.control;

/**
 * Abstraction of a closed-loop controller. The framework's simulator consumes
 * this interface for any controller type; it never depends on a specific
 * physical system.
 */
public interface Controller {

	/** Number of control inputs produced by this controller. */
	int inputDimension();

	/**
	 * Computes the control input for the current state against a reference.
	 *
	 * @param time      current simulation time
	 * @param reference reference state vector
	 * @param state     measured state vector
	 * @return control input vector
	 */
	double[] control(double time, double[] reference, double[] state);
}