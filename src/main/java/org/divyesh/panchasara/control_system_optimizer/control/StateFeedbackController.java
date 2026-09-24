package org.divyesh.panchasara.control_system_optimizer.control;

import org.apache.commons.math3.linear.Array2DRowRealMatrix;
import org.apache.commons.math3.linear.RealMatrix;

/**
 * State-feedback controller for single-input systems:
 *
 * u = -K * (x - r)          when tracking a reference,
 * u = -K * x                when regulating to the origin (reference ignored).
 *
 * The gain matrix K is arbitrary (1 x n here), so the class is not tied to the
 * spring-damper system or to exactly two gains.
 */
public final class StateFeedbackController implements Controller {

	private final RealMatrix k;
	private final boolean tracking;
	private final double[] singleRow;

	/**
	 * @param k        feedback gain matrix of dimension {@code m x n}
	 * @param tracking if true the reference is subtracted from the state before
	 *                 the feedback is applied; otherwise pure regulation is used
	 */
	public StateFeedbackController(RealMatrix k, boolean tracking) {
		if (k == null || k.getRowDimension() == 0 || k.getColumnDimension() == 0) {
			throw new IllegalArgumentException("Gain matrix K must be non-empty");
		}
		this.k = k;
		this.tracking = tracking;
		this.singleRow = k.getRowDimension() == 1 ? k.getRow(0) : null;
	}

	/**
	 * Convenience constructor wrapping a single gain row vector (single-input system).
	 *
	 * @param gains    the row of gains, length n
	 * @param tracking see {@link #StateFeedbackController(RealMatrix, boolean)}
	 */
	public static StateFeedbackController of(double[] gains, boolean tracking) {
		if (gains == null || gains.length == 0) {
			throw new IllegalArgumentException("Gains must be non-empty");
		}
		return new StateFeedbackController(new Array2DRowRealMatrix(new double[][] { gains }), tracking);
	}

	@Override
	public int inputDimension() {
		return k.getRowDimension();
	}

	@Override
	public double[] control(double time, double[] reference, double[] state) {
		if (k.getColumnDimension() != state.length) {
			throw new IllegalArgumentException(
					"State has wrong dimension: expected " + k.getColumnDimension() + " got " + state.length);
		}
		if (singleRow != null) {
			double u = 0.0;
			for (int i = 0; i < state.length; i++) {
				double x = state[i] - (tracking ? reference[i] : 0.0);
				u -= singleRow[i] * x;
			}
			return new double[] { u };
		}
		double[] error = new double[state.length];
		for (int i = 0; i < state.length; i++) {
			error[i] = state[i] - (tracking ? reference[i] : 0.0);
		}
		double[] result = k.operate(error);
		for (int i = 0; i < result.length; i++) {
			result[i] = -result[i];
		}
		return result;
	}

	/** The raw feedback gain matrix K. */
	public RealMatrix gainMatrix() {
		return k;
	}

	public boolean isTracking() {
		return tracking;
	}
}