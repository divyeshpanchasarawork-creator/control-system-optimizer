package org.divyesh.panchasara.control_system_optimizer.analysis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class SteadyStateResolverTest {

	@Test
	void pdWithoutFeedforwardLeavesSpringLoadOffset() {
		// m=1 c=0.5 k=10, K=[10,5], r1=1: x_ss = Kp*r1/(k+Kp) = 10/20, e_ss = 0.5
		SteadyState ss = SteadyStateResolver.resolve(new double[] { 10, 5 }, 10.0, 1.0, true, false);
		assertEquals(0.5, ss.xSS(), 1e-9);
		assertEquals(0.5, ss.eSS(), 1e-9);
	}

	@Test
	void feedforwardCancelsStaticLoadExactly() {
		SteadyState ss = SteadyStateResolver.resolve(new double[] { 10, 5 }, 10.0, 1.0, true, true);
		assertEquals(1.0, ss.xSS(), 1e-9);
		assertEquals(0.0, ss.eSS(), 1e-9);
	}

	@Test
	void regulationHasNoTrackableSteadyState() {
		SteadyState ss = SteadyStateResolver.resolve(new double[] { 10, 5 }, 10.0, 1.0, false, false);
		assertNull(ss.xSS());
		assertNull(ss.eSS());
	}

	@Test
	void untrackableDenominatorIsUndefined() {
		SteadyState ss = SteadyStateResolver.resolve(new double[] { -10, 5 }, 10.0, 1.0, true, false);
		assertNull(ss.xSS());
		assertNull(ss.eSS());
	}
}
