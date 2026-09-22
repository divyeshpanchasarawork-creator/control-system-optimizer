package org.divyesh.panchasara.control_system_optimizer.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.commons.math3.linear.Array2DRowRealMatrix;
import org.junit.jupiter.api.Test;

class StabilityAnalyzerTest {

	private final StabilityAnalyzer analyzer = new StabilityAnalyzer();

	@Test
	void stableMatrixRecognized() {
		StabilityResult result = analyzer.analyze(
				new Array2DRowRealMatrix(new double[][] { { -1, 1 }, { 0, -0.5 } }));
		assertTrue(result.stable());
		assertTrue(result.maxRealPart() < 0.0);
		assertEquals(2, result.eigenvalues().size());
	}

	@Test
	void unstableMatrixRejected() {
		StabilityResult result = analyzer.analyze(
				new Array2DRowRealMatrix(new double[][] { { 1, 0 }, { 0, -0.5 } }));
		assertFalse(result.stable());
		assertTrue(result.maxRealPart() > 0.0);
	}

	@Test
	void closedLoopWithPositiveDampingContributionIsUnstable() {
		StabilityResult result = analyzer.analyze(
				new Array2DRowRealMatrix(new double[][] { { 0, 1 }, { -2, 0.5 } }));
		assertFalse(result.stable());
		assertEquals(2, result.eigenvalues().size());
	}
}