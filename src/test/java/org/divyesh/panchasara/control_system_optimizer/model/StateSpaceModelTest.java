package org.divyesh.panchasara.control_system_optimizer.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.apache.commons.math3.linear.Array2DRowRealMatrix;
import org.junit.jupiter.api.Test;

class StateSpaceModelTest {

	@Test
	void dimensionsAndDerivativeAreComputed() {
		StateSpaceModel model = StateSpaceModel.of(
				new Array2DRowRealMatrix(new double[][] { { 0, 1 }, { -10, -0.5 } }),
				new Array2DRowRealMatrix(new double[][] { { 0 }, { 1 } }));

		assertEquals(2, model.stateDimension());
		assertEquals(1, model.inputDimension());

		double[] xdot = model.derivativeAt(new double[] { 1, 0 }, new double[] { 5 });
		assertEquals(0.0, xdot[0], 1e-12);
		assertEquals(-10.0 + 5.0, xdot[1], 1e-12);
	}

	@Test
	void rejectsNonSquareA() {
		assertThrows(IllegalArgumentException.class, () -> StateSpaceModel.of(
				new Array2DRowRealMatrix(new double[][] { { 0, 1 } }), new Array2DRowRealMatrix(new double[][] { { 0 } })));
	}

	@Test
	void rejectsDimensionMismatchInDerivative() {
		StateSpaceModel model = StateSpaceModel.of(
				new Array2DRowRealMatrix(new double[][] { { 0, 1 }, { -10, -0.5 } }),
				new Array2DRowRealMatrix(new double[][] { { 0 }, { 1 } }));
		assertThrows(IllegalArgumentException.class, () -> model.derivativeAt(new double[] { 1 }, new double[] { 5 }));
	}
}