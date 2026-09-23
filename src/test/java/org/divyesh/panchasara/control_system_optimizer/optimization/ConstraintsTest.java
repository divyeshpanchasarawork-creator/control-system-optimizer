package org.divyesh.panchasara.control_system_optimizer.optimization;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ConstraintsTest {

	@Test
	void absentConstraintsAreNotEnforced() {
		Constraints constraints = new Constraints(null, null, null);
		Constraints.ConstraintReport report = constraints.check(100.0, 50.0, Double.NaN);
		assertNull(report.maxControl());
		assertNull(report.maxOvershoot());
		assertNull(report.maxSettlingTime());
	}

	@Test
	void satisfiedLimitsReportAchievedAndSatisfied() {
		Constraints constraints = new Constraints(20.0, 10.0, 3.0);
		Constraints.ConstraintReport report = constraints.check(8.5, 2.0, 1.4);
		assertTrue(report.maxControl().satisfied());
		assertEquals(8.5, report.maxControl().achieved());
		assertEquals(20.0, report.maxControl().limit());
		assertEquals("max-control", report.maxControl().id());
		assertTrue(report.maxOvershoot().satisfied());
		assertTrue(report.maxSettlingTime().satisfied());
	}

	@Test
	void violatedLimitsReportNotSatisfied() {
		Constraints constraints = new Constraints(20.0, 10.0, 3.0);
		Constraints.ConstraintReport report = constraints.check(30.0, 12.0, 4.0);
		assertFalse(report.maxControl().satisfied());
		assertFalse(report.maxOvershoot().satisfied());
		assertFalse(report.maxSettlingTime().satisfied());
	}

	@Test
	void neverSettledViolatesSettlingTimeConstraint() {
		Constraints constraints = new Constraints(null, null, 3.0);
		Constraints.ConstraintReport report = constraints.check(5.0, 0.0, Double.NaN);
		assertFalse(report.maxSettlingTime().satisfied());
		assertNull(report.maxSettlingTime().achieved());
	}

	@Test
	void limitsMustBePositive() {
		assertThrows(IllegalArgumentException.class, () -> new Constraints(0.0, null, null));
		assertThrows(IllegalArgumentException.class, () -> new Constraints(null, -1.0, null));
		assertThrows(IllegalArgumentException.class, () -> new Constraints(null, null, 0.0));
	}
}