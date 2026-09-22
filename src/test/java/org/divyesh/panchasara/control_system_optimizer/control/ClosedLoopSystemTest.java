package org.divyesh.panchasara.control_system_optimizer.control;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.divyesh.panchasara.control_system_optimizer.systems.SpringDamperSystem;
import org.junit.jupiter.api.Test;

class ClosedLoopSystemTest {

	@Test
	void closedLoopMatrixIsABK() {
		DynamicSystem system = new SpringDamperSystem(1.0, 0.5, 10.0);
		StateFeedbackController controller = StateFeedbackController.of(new double[] { 10, 5 }, true);

		ClosedLoopSystem closedLoop = ClosedLoopSystem.of(system, controller);
		assertEquals(0.0, closedLoop.acl().getEntry(0, 0), 1e-9);
		assertEquals(1.0, closedLoop.acl().getEntry(0, 1), 1e-9);
		assertEquals(-10.0 - 10.0, closedLoop.acl().getEntry(1, 0), 1e-9);
		assertEquals(-0.5 - 5.0, closedLoop.acl().getEntry(1, 1), 1e-9);
	}
}