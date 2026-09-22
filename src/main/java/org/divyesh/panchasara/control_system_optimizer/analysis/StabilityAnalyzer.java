package org.divyesh.panchasara.control_system_optimizer.analysis;

import java.util.ArrayList;
import java.util.List;

import org.apache.commons.math3.linear.EigenDecomposition;
import org.apache.commons.math3.linear.RealMatrix;
import org.apache.commons.math3.util.FastMath;
import org.springframework.stereotype.Component;

/**
 * Analyzes the stability of a continuous-time linear system from its state
 * matrix.
 *
 * <p>A system is asymptotically stable if and only if every eigenvalue of A has
 * a strictly negative real part. This is the only stability criterion considered
 * in version 1 (the state matrix is always real and square).
 */
@Component
public final class StabilityAnalyzer {

	/**
	 * Analyzes the matrix A (typically A_cl = A - B*K).
	 *
	 * @param matrix the continuous-time state matrix
	 * @return stability result
	 * @throws IllegalArgumentException if eigenvalues cannot be computed
	 */
	public StabilityResult analyze(RealMatrix matrix) {
		if (matrix == null || matrix.getRowDimension() != matrix.getColumnDimension()) {
			throw new IllegalArgumentException("Stability analysis requires a square matrix");
		}
		final EigenDecomposition decomposition;
		try {
			decomposition = new EigenDecomposition(matrix);
		} catch (RuntimeException e) {
			throw new IllegalArgumentException("Could not compute eigenvalues of the given matrix", e);
		}

		List<ComplexValue> eigenvalues = new ArrayList<>();
		double maxReal = Double.NEGATIVE_INFINITY;
		double minReal = Double.POSITIVE_INFINITY;
		for (int i = 0; i < matrix.getRowDimension(); i++) {
			double real = decomposition.getRealEigenvalue(i);
			double imag = decomposition.getImagEigenvalue(i);
			eigenvalues.add(new ComplexValue(real, imag));
			maxReal = FastMath.max(maxReal, real);
			minReal = FastMath.min(minReal, real);
		}
		return new StabilityResult(maxReal < 0.0, maxReal, minReal, List.copyOf(eigenvalues));
	}
}