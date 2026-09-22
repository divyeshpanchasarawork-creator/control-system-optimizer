package org.divyesh.panchasara.control_system_optimizer.simulation;

import java.util.List;
import java.util.Objects;

/**
 * The result of a numerical simulation: an ordered list of trajectory points.
 */
public record Trajectory(int stateDimension, int inputDimension, List<TrajectoryPoint> points) {

	public Trajectory {
		points = List.copyOf(Objects.requireNonNull(points, "points"));
		if (points.isEmpty()) {
			throw new IllegalArgumentException("Trajectory must contain at least one point");
		}
	}

	public double startTime() {
		return points.getFirst().time();
	}

	public double endTime() {
		return points.getLast().time();
	}

	/** The state at the final recorded time. */
	public double[] finalState() {
		return points.getLast().state();
	}

	/** The control input at the final recorded time. */
	public double[] finalControl() {
		return points.getLast().control();
	}
}