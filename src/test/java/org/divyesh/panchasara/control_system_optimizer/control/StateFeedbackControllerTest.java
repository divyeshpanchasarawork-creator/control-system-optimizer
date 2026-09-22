package org.divyesh.panchasara.control_system_optimizer.control;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class StateFeedbackControllerTest {

	@Test
	void computesTrackingLaw() {
		StateFeedbackController controller = StateFeedbackController.of(new double[] { 10, 5 }, true);
		double[] u = controller.control(0.0, new double[] { 1, 0 }, new double[] { 0.7, 0.1 });
		assertEquals(-1.0 * (10 * (0.7 - 1) + 5 * (0.1 - 0)), u[0], 1e-9);
	}

	@Test
	void ignoresReferenceWhenRegulating() {
		StateFeedbackController controller = StateFeedbackController.of(new double[] { 10, 5 }, false);
		double[] u = controller.control(0.0, new double[] { 99, 99 }, new double[] { 0.7, 0.1 });
		assertEquals(-1.0 * (10 * 0.7 + 5 * 0.1), u[0], 1e-9);
	}

	@Test
	void rejectsWrongStateDimension() {
		StateFeedbackController controller = StateFeedbackController.of(new double[] { 10, 5 }, true);
		assertThrows(IllegalArgumentException.class, () -> controller.control(0, new double[] { 1 }, new double[] { 1 }));
	}
}