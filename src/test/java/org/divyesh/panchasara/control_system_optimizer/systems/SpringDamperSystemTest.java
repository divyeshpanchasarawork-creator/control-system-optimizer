package org.divyesh.panchasara.control_system_optimizer.systems;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.divyesh.panchasara.control_system_optimizer.model.DynamicSystem;
import org.junit.jupiter.api.Test;

class SpringDamperSystemTest {

	@Test
	void buildsCorrectABMatrices() {
		DynamicSystem system = new SpringDamperSystem(1.0, 0.5, 10.0);
		assertEquals(2, system.dimension());

		assertEquals(0.0, system.stateSpaceModel().a().getEntry(0, 0), 1e-9);
		assertEquals(1.0, system.stateSpaceModel().a().getEntry(0, 1), 1e-9);
		assertEquals(-10.0, system.stateSpaceModel().a().getEntry(1, 0), 1e-9);
		assertEquals(-0.5, system.stateSpaceModel().a().getEntry(1, 1), 1e-9);

		assertEquals(0.0, system.stateSpaceModel().b().getEntry(0, 0), 1e-9);
		assertEquals(1.0, system.stateSpaceModel().b().getEntry(1, 0), 1e-9);
	}

	@Test
	void increasingMassChangesBothMatrices() {
		var light = new SpringDamperSystem(1.0, 0.5, 10.0);
		var heavy = new SpringDamperSystem(2.0, 0.5, 10.0);

		assertEquals(-10.0, light.stateSpaceModel().a().getEntry(1, 0), 1e-9);
		assertEquals(-5.0, heavy.stateSpaceModel().a().getEntry(1, 0), 1e-9);
		assertEquals(1.0, light.stateSpaceModel().b().getEntry(1, 0), 1e-9);
		assertEquals(0.5, heavy.stateSpaceModel().b().getEntry(1, 0), 1e-9);
	}

	@Test
	void derivativeMatchesStateSpaceMath() {
		var system = new SpringDamperSystem(2.0, 4.0, 8.0);
		double[] xdot = system.derivative(0.0, new double[] { 1, 2 }, new double[] { 3 });
		assertEquals(2.0, xdot[0], 1e-9);
		assertEquals(-8.0 / 2.0 * 1 - 4.0 / 2.0 * 2 + 3.0 / 2.0, xdot[1], 1e-9);
	}

	@Test
	void validatesParameters() {
		assertThrows(IllegalArgumentException.class, () -> new SpringDamperSystem(0.0, 0.5, 10.0));
		assertThrows(IllegalArgumentException.class, () -> new SpringDamperSystem(-1.0, 0.5, 10.0));
		assertThrows(IllegalArgumentException.class, () -> new SpringDamperSystem(1.0, -0.1, 10.0));
		assertThrows(IllegalArgumentException.class, () -> new SpringDamperSystem(1.0, 0.5, 0.0));
	}

	@Test
	void exposesParameters() {
		var system = new SpringDamperSystem(1.0, 2.0, 3.0);
		assertEquals(1.0, system.parameters().get("mass"));
		assertEquals(2.0, system.parameters().get("damping"));
		assertEquals(3.0, system.parameters().get("springConstant"));
	}
}