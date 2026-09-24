package org.divyesh.panchasara.control_system_optimizer.model;

import org.apache.commons.math3.linear.Array2DRowRealMatrix;
import org.apache.commons.math3.linear.RealMatrix;

/**
 * A continuous-time linear time-invariant state-space model
 *
 * x' = A*x + B*u
 * y   = C*x + D*u
 *
 * where x is the n-dimensional state, u the m-dimensional control input and
 * y the p-dimensional measured output.
 *
 * <p>For simulation purposes only {@code A} and {@code B} are required. The output
 * matrices {@code C} and {@code D} are optional and default to the identity /
 * zero operators when created via {@link #of(RealMatrix, RealMatrix)}.
 */
public record StateSpaceModel(RealMatrix a, RealMatrix b, RealMatrix c, RealMatrix d) {

	public StateSpaceModel {
		if (a == null || b == null) {
			throw new IllegalArgumentException("Matrices A and B must not be null");
		}
		int n = a.getColumnDimension();
		int m = b.getColumnDimension();
		if (a.getRowDimension() != n) {
			throw new IllegalArgumentException("Matrix A must be square");
		}
		if (b.getRowDimension() != n) {
			throw new IllegalArgumentException("Matrix B must have " + n + " rows");
		}
		if (c != null && c.getColumnDimension() != n) {
			throw new IllegalArgumentException("Matrix C must have " + n + " columns");
		}
		if (d != null && (d.getRowDimension() != outputRows(c) || d.getColumnDimension() != m)) {
			throw new IllegalArgumentException("Matrix D dimensions must match C and B");
		}
	}

	/**
	 * Creates a state-space model with identity output matrix C and zero
	 * feedthrough matrix D.
	 */
	public static StateSpaceModel of(RealMatrix a, RealMatrix b) {
		int n = a.getRowDimension();
		int m = b.getColumnDimension();
		RealMatrix c = new Array2DRowRealMatrix(n, n);
		for (int i = 0; i < n; i++) {
			c.setEntry(i, i, 1.0);
		}
		RealMatrix d = new Array2DRowRealMatrix(n, m);
		return new StateSpaceModel(a, b, c, d);
	}

	private static int outputRows(RealMatrix c) {
		return c == null ? -1 : c.getRowDimension();
	}

	/** Number of states. */
	public int stateDimension() {
		return a.getRowDimension();
	}

	/** Number of control inputs. */
	public int inputDimension() {
		return b.getColumnDimension();
	}

	/** Computes x' = A*x + B*u for the given state and control input. */
	public double[] derivativeAt(double[] x, double[] u) {
		int n = stateDimension();
		int m = inputDimension();
		if (x.length != n) {
			throw new IllegalArgumentException("State has wrong dimension: expected " + n + " got " + x.length);
		}
		if (u.length != m) {
			throw new IllegalArgumentException("Input has wrong dimension: expected " + m + " got " + u.length);
		}
		double[] xdot = new double[n];
		double[][] aData = a.getData();
		double[][] bData = b.getData();
		for (int i = 0; i < n; i++) {
			double[] aRow = aData[i];
			double sum = 0.0;
			for (int j = 0; j < n; j++) {
				sum += aRow[j] * x[j];
			}
			double[] bRow = bData[i];
			for (int j = 0; j < m; j++) {
				sum += bRow[j] * u[j];
			}
			xdot[i] = sum;
		}
		return xdot;
	}
}