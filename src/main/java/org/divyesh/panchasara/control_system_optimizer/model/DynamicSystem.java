package org.divyesh.panchasara.control_system_optimizer.model;

import java.util.Map;

/**
 * Abstraction of a generic dynamical system. The framework only depends on this
 * interface for simulation, analysis and optimization — concrete physical systems
 * (spring-damper, DC motor, inverted pendulum, ...) provide implementations.
 *
 * <p>The current implementation targets continuous-time linear time-invariant
 * systems, but the {@link #derivative(double, double[], double[])} method is the
 * single point through which the simulator evaluates dynamics, keeping the door
 * open for nonlinear and time-varying systems later.
 */
public interface DynamicSystem {

	/** Number of state variables. */
	int dimension();

	/** The concrete system family, used for API routing and catalog discovery. */
	SystemType systemType();

	/** The underlying continuous-time state-space model (A, B, C, D). */
	StateSpaceModel stateSpaceModel();

	/**
	 * Evaluates the state derivative at a point in time.
	 *
	 * @param time    current simulation time
	 * @param state   current state vector
	 * @param control current control input vector
	 * @return the state derivative vector
	 */
	double[] derivative(double time, double[] state, double[] control);

	/** Named physical parameters of this system instance. */
	Map<String, Double> parameters();
}