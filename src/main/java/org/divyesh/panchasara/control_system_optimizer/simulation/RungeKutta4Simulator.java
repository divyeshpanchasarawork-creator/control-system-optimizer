package org.divyesh.panchasara.control_system_optimizer.simulation;

import java.util.ArrayList;
import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.control.Controller;
import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
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
 */
@Component
public final class RungeKutta4Simulator implements Simulator {

	@Override
	public Trajectory simulate(SimulationSetup setup) {
		DynamicSystem system = setup.system();
		int n = system.dimension();
		int m = system.stateSpaceModel().inputDimension();

		double t0 = setup.startTime();
		double tEnd = setup.endTime();
		double dt = setup.timeStep();

		double[] x = setup.initialState().clone();
		double[] reference = setup.reference().clone();

		List<TrajectoryPoint> points = new ArrayList<>();
		points.add(new TrajectoryPoint(t0, x.clone(), controlAt(setup, t0, x, m), reference.clone()));

		double t = t0;
		while (t < tEnd) {
			double h = Math.min(dt, tEnd - t);

			double[] k1 = system.derivative(t, x, controlAt(setup, t, x, m));
			double[] x2 = addScaled(x, 0.5 * h, k1);
			double[] k2 = system.derivative(t + 0.5 * h, x2, controlAt(setup, t + 0.5 * h, x2, m));
			double[] x3 = addScaled(x, 0.5 * h, k2);
			double[] k3 = system.derivative(t + 0.5 * h, x3, controlAt(setup, t + 0.5 * h, x3, m));
			double[] x4 = addScaled(x, h, k3);
			double[] k4 = system.derivative(t + h, x4, controlAt(setup, t + h, x4, m));

			double[] newX = new double[n];
			for (int i = 0; i < n; i++) {
				newX[i] = x[i] + (h / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
			}
			x = newX;
			t += h;

			points.add(new TrajectoryPoint(t, x.clone(), controlAt(setup, t, x, m), reference.clone()));
		}

		return new Trajectory(n, m, points);
	}

	private double[] controlAt(SimulationSetup setup, double time, double[] state, int m) {
		Controller controller = setup.controller();
		if (controller == null) {
			return new double[m];
		}
		double[] u = controller.control(time, setup.reference(), state);
		if (u.length != m) {
			throw new IllegalStateException("Controller returned wrong input dimension: expected " + m + " got " + u.length);
		}
		return u;
	}

	private double[] addScaled(double[] x, double scale, double[] k) {
		int n = x.length;
		double[] out = new double[n];
		for (int i = 0; i < n; i++) {
			out[i] = x[i] + scale * k[i];
		}
		return out;
	}
}