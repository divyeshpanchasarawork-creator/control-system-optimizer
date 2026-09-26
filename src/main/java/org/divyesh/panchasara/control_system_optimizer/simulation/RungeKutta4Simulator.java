package org.divyesh.panchasara.control_system_optimizer.simulation;

import java.util.ArrayList;
import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.control.Controller;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.util.NumericalGuard;
import org.springframework.stereotype.Component;

/**
 * Fourth-order explicit Runge-Kutta integrator with a fixed time step.
 *
 * <p>At every stage the controller is re-evaluated against the extrapolated
 * state, so closed-loop dynamics are integrated consistently:
 *
 * x' = f(t, x, u(t, r, x)) with u = controller.control(...)
 *
 * If no controller is present the input is the zero vector (open-loop run).
 * The recorded control input at each trajectory point is the controller output
 * evaluated at the point itself.
 *
 * <p>The step loop reuses its scratch buffers across all iterations so a grid
 * search never allocates beyond the derivative arrays returned by the system.
 */
@Component
public final class RungeKutta4Simulator implements Simulator {

	/** Upper bound on recorded steps, guarding against tiny time steps. */
	public static final long MAX_STEPS = 200_000;

	@Override
	public Trajectory simulate(SimulationSetup setup) {
		DynamicSystem system = setup.system();
		int n = system.dimension();
		int m = system.stateSpaceModel().inputDimension();
		double t0 = setup.startTime();
		double tEnd = setup.endTime();
		double dt = setup.timeStep();

		// Guards the step loop below: a non-positive dt makes `t` decrease forever
		// while points keep accumulating, and a NaN dt silently ends the run after a
		// single sample. Both are rejected before any integration happens.
		NumericalGuard.requireFinite(t0, "startTime");
		NumericalGuard.requireFinite(tEnd, "endTime");
		NumericalGuard.requirePositive(dt, "timeStep");
		NumericalGuard.requireAfter(t0, tEnd, "endTime");

		long stepCount = (long) Math.ceil((tEnd - t0) / dt);
		if (stepCount > MAX_STEPS) {
			throw new IllegalArgumentException("Simulation would require " + stepCount
					+ " steps (maximum " + MAX_STEPS + "); increase the time step");
		}

		double[] x = setup.initialState().clone();
		double[] storedReference = setup.reference().clone();

		List<TrajectoryPoint> points = new ArrayList<>();
		points.add(new TrajectoryPoint(t0, x.clone(), controlAt(setup, t0, x), storedReference));

		double[] x2 = new double[n];
		double[] x3 = new double[n];
		double[] x4 = new double[n];
		double[] newX = new double[n];

		double t = t0;
		while (t < tEnd) {
			double h = Math.min(dt, tEnd - t);

			double[] k1 = system.derivative(t, x, controlAt(setup, t, x));
			addScaled(x, 0.5 * h, k1, x2);
			double[] k2 = system.derivative(t + 0.5 * h, x2, controlAt(setup, t + 0.5 * h, x2));
			addScaled(x, 0.5 * h, k2, x3);
			double[] k3 = system.derivative(t + 0.5 * h, x3, controlAt(setup, t + 0.5 * h, x3));
			addScaled(x, h, k3, x4);
			double[] k4 = system.derivative(t + h, x4, controlAt(setup, t + h, x4));

			for (int i = 0; i < n; i++) {
				newX[i] = x[i] + (h / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
			}
			x = newX;
			t += h;

			points.add(new TrajectoryPoint(t, newX.clone(), controlAt(setup, t, newX), storedReference));
		}

		return new Trajectory(n, m, points);
	}

	private double[] controlAt(SimulationSetup setup, double time, double[] state) {
		Controller controller = setup.controller();
		if (controller == null) {
			return new double[setup.system().stateSpaceModel().inputDimension()];
		}
		double[] u = controller.control(time, setup.reference(), state);
		if (u.length != setup.system().stateSpaceModel().inputDimension()) {
			throw new IllegalStateException("Controller returned wrong input dimension: expected "
					+ setup.system().stateSpaceModel().inputDimension() + " got " + u.length);
		}
		double sat = setup.saturation();
		if (sat > 0.0) {
			for (int i = 0; i < u.length; i++) {
				u[i] = Math.max(-sat, Math.min(sat, u[i]));
			}
		}
		return u;
	}

	private void addScaled(double[] x, double scale, double[] k, double[] out) {
		for (int i = 0; i < x.length; i++) {
			out[i] = x[i] + scale * k[i];
		}
	}
}