package org.divyesh.panchasara.control_system_optimizer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Description;
import org.hamcrest.Matcher;
import org.hamcrest.TypeSafeMatcher;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	private static final String SYSTEM = """
			"system":{"type":"SPRING_DAMPER","parameters":{"mass":1,"damping":0.5,"springConstant":10}}
			""";
	private static final String SIMULATION = """
			"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":0.05}
			""";

	@Test
	void systemsCatalogIsExposed() throws Exception {
		mockMvc.perform(get("/api/systems"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].type").value("SPRING_DAMPER"));
	}

	@Test
	void simulationReturnsTrajectoryAndMetrics() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},%s}
				""".formatted(SYSTEM, SIMULATION);
		MvcResult result = mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.metrics").exists())
				.andExpect(jsonPath("$.trajectory[0].time").value(0.0))
				.andReturn();
		assertThat(result.getResponse().getContentAsString())
				.doesNotContain("NaN", "Infinity");
	}

	@Test
	void stabilityAnalysisReturnsEigenvalues() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/analysis/stability")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.stable").value(true))
				.andExpect(jsonPath("$.eigenvalues.length()").value(2));
	}

	@Test
	void gridOptimizationIsDeterministic() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
				"optimizer":{"type":"GRID_SEARCH","resolution":[11,7]},"objective":{},%s}
				""".formatted(SYSTEM, SIMULATION);
		String first = content(body);
		String second = content(body);
		assertThat(withoutElapsedMillis(first)).isEqualTo(withoutElapsedMillis(second));
		assertThat(first).doesNotContain("NaN", "Infinity");
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feasible").value(true))
				.andExpect(jsonPath("$.bestGain.length()").value(2));
	}

	@Test
	void differentialEvolutionIsDeterministic() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
				"optimizer":{"type":"DIFFERENTIAL_EVOLUTION","populationSize":16,"maxIterations":100,"seed":42},"objective":{},%s}
				""".formatted(SYSTEM, SIMULATION);
		String first = content(body);
		String second = content(body);
		assertThat(withoutElapsedMillis(first)).isEqualTo(withoutElapsedMillis(second));
		assertThat(first).doesNotContain("NaN", "Infinity");
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.convergence.length()").value(101))
				.andExpect(jsonPath("$.convergence[0].generation").value(0))
				.andExpect(jsonPath("$.optimizerConfig.seed").value(42));
	}

	@Test
	void gridSearchCanReturnCostSurface() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
				"optimizer":{"type":"GRID_SEARCH","resolution":[11,6],"includeCostSurface":true},"objective":{},%s}
				""".formatted(SYSTEM, SIMULATION);
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.costSurface.length()").value(11))
				.andExpect(jsonPath("$.costSurface[0].length()").value(6))
				.andExpect(jsonPath("$.metricSurfaces.iae[0][0]").exists())
				.andExpect(jsonPath("$.metricSurfaces.controlEffort[0][0]").exists())
				.andExpect(jsonPath("$.optimizerConfig.resolution[0]").value(11));
	}

	@Test
	void simulationHonorsSettlingBand() throws Exception {
		// with feedback-only tracking the steady-state position is kp/(10+kp),
		// so high gains settle; the 10% band makes settling even looser
		mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{%s,"controller":{"type":"STATE_FEEDBACK","gain":[1000,200]},
								"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":2,"timeStep":0.01,"settlingBand":10}}
								""".formatted(SYSTEM)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.metrics.settlingTime").isNumber());
	}

	@Test
	void simulationSettlingIsNullWhenNeverSettled() throws Exception {
		// low gains leave a residual offset > 2% forever
		mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{%s,"controller":{"type":"STATE_FEEDBACK","gain":[1,1]},
								"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":2,"timeStep":0.01}}
								""".formatted(SYSTEM)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.metrics.settlingTime").doesNotExist())
				.andExpect(jsonPath("$.metrics.iae").isNumber());
	}

	@Test
	void scalarPositionMetricsMatchSteadyStateFormula() throws Exception {
		// gain [10,5] on m=1, c=0.5, k=2 leaves steady-state position x_ss = Kp/(k+Kp)*r
		// = 10/12, so e_ss = k/(k+Kp)*r = 2/12 ~= 0.1667. Scalar position error
		// starts at |r - x| = 1.0, so maxAbsError cannot exceed the step size.
		mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{"system":{"type":"SPRING_DAMPER","parameters":{"mass":1,"damping":0.5,"springConstant":2}},
								"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},
								"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":10,"timeStep":0.01}}
								""".formatted()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.metrics.finalError").value(near(0.1667, 0.002)))
				.andExpect(jsonPath("$.metrics.maxAbsError").value(near(1.0, 0.001)))
				.andExpect(jsonPath("$.metrics.settlingTimeByBand.length()").value(near(3, 0)))
				.andExpect(jsonPath("$.metrics.settlingTimeByBand[0].bandPercent").value(near(2, 0)))
				.andExpect(jsonPath("$.metrics.settlingTimeByBand[0].time").doesNotExist())
				.andExpect(jsonPath("$.metrics.settlingTimeByBand[1].bandPercent").value(near(5, 0)))
				.andExpect(jsonPath("$.metrics.settlingTimeByBand[1].time").doesNotExist())
				.andExpect(jsonPath("$.metrics.settlingTimeByBand[2].bandPercent").value(near(10, 0)))
				.andExpect(jsonPath("$.metrics.settlingTimeByBand[2].time").doesNotExist());
	}

	@Test
	void verificationEndpointReportsPasteAbleGoldenNumbers() throws Exception {
		mockMvc.perform(post("/api/verification/run"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("PASS"))
				.andExpect(jsonPath("$.goldenCases.length()").value(near(3, 0)))
				.andExpect(jsonPath("$.goldenCases[0].id").value("golden-1"))
				.andExpect(jsonPath("$.goldenCases[1].id").value("golden-2"))
				.andExpect(jsonPath("$.goldenCases[2].id").value("golden-3"))
				.andExpect(jsonPath("$.goldenCases[1].poleRe").value(near(-2.75, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[1].omegaN").value(near(3.4641, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[1].idealPosition").value(near(0.8333, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[1].steadyStateError").value(near(0.1667, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[1].analyticControlAtZero").value(near(10.0, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[2].poleRe").value(near(-1.6141, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[2].omegaN").value(near(1.9437, 1e-3)))
				.andExpect(jsonPath("$.goldenCases[2].steadyStateError").value(near(0.5294, 1e-3)))
				.andExpect(jsonPath("$.convergence.length()").value(near(3, 0)))
				.andExpect(jsonPath("$.consistency.length()").value(near(3, 0)))
				.andExpect(jsonPath("$.crossValidation.length()").value(near(2, 0)));
	}

	private static Matcher<Object> near(double expected, double tolerance) {
		return new TypeSafeMatcher<>() {
			@Override
			protected boolean matchesSafely(Object item) {
				return item instanceof Number n && Math.abs(n.doubleValue() - expected) <= tolerance;
			}

			@Override
			public void describeTo(Description description) {
				description.appendText("a number within " + tolerance + " of " + expected);
			}
		};
	}

	@Test
	void optimizationReportsObjectiveBreakdown() throws Exception {
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
								"optimizer":{"type":"GRID_SEARCH","resolution":[11,6]},"objective":{},%s}
								""".formatted(SYSTEM, SIMULATION)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.objectiveBreakdown").exists())
				.andExpect(jsonPath("$.objectiveBreakdown.total").isNumber())
				.andExpect(jsonPath("$.objectiveBreakdown.normalized").isBoolean())
				.andExpect(jsonPath("$.objectiveBreakdown.terms.length()").value(near(4, 0)))
				.andExpect(jsonPath("$.objectiveBreakdown.terms[0].key").value("trackingError"))
				.andExpect(jsonPath("$.objectiveBreakdown.terms[0].contribution").isNumber())
				.andExpect(jsonPath("$.objectiveBreakdown.terms[0].sharePercent").isNumber());
	}

	@Test
	void satisfiedConstraintsAreReported() throws Exception {
		// feedback-only tracking leaves a residual offset kp/(10+kp); large kp
		// settles within the 2% band, so a permissive constraint set is feasible
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[2000,500]},
				"optimizer":{"type":"GRID_SEARCH","resolution":[7,5]},"objective":{},
				"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":2,"timeStep":0.01},
				"constraints":{"maxControl":3000,"maxOvershoot":100,"maxSettlingTime":2}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feasible").value(true))
				.andExpect(jsonPath("$.constraints.length()").value(3))
				.andExpect(jsonPath("$.constraints[0].id").value("max-control"))
				.andExpect(jsonPath("$.constraints[0].satisfied").value(true))
				.andExpect(jsonPath("$.constraints[1].id").value("max-overshoot"))
				.andExpect(jsonPath("$.constraints[1].satisfied").value(true))
				.andExpect(jsonPath("$.constraints[2].id").value("max-settling-time"))
				.andExpect(jsonPath("$.constraints[2].satisfied").value(true));
	}

	@Test
	void impossibleConstraintsYieldInfeasibleResult() throws Exception {
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
								"optimizer":{"type":"GRID_SEARCH","resolution":[11,6]},"objective":{},
								"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":0.05},
								"constraints":{"maxControl":0.0001,"maxOvershoot":0.0001,"maxSettlingTime":0.0001}}
								""".formatted(SYSTEM)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feasible").value(false));
	}

	@Test
	void infeasibleRunReportsTheCandidateItCameClosestTo() throws Exception {
		// The shipped defaults against the shipped gain range. A proportional
		// controller leaves a standing error of kp/(10+kp), so the 0.05 limit would
		// need kp >= 190 while the range stops at 40, and that same standing error
		// keeps the response outside the 2% settling band. Every candidate misses
		// both, so the run has to say so precisely rather than only that it failed.
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[40,20]},
				"optimizer":{"type":"GRID_SEARCH","resolution":[11,6]},"objective":{},
				"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":10,"timeStep":0.05},
				"constraints":{"maxControl":50,"maxOvershoot":10,"maxSettlingTime":5,
					"maxSteadyStateError":0.05,"maxControlEnergy":40}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feasible").value(false))
				.andExpect(jsonPath("$.bestGain").doesNotExist())
				// the point of the whole exercise: a rejected run still explains itself
				.andExpect(jsonPath("$.nearestMiss.gain.length()").value(2))
				.andExpect(jsonPath("$.nearestMiss.metrics").exists())
				.andExpect(jsonPath("$.nearestMiss.violatedConstraints[*].id",
						hasItems("max-steady-state-error", "max-settling-time")))
				// only limits that actually failed, never the ones that passed
				.andExpect(jsonPath("$.nearestMiss.violatedConstraints[*].id", not(hasItem("max-control"))))
				.andExpect(jsonPath("$.infeasibleReason", containsString("Closest candidate K = ")))
				.andExpect(jsonPath("$.infeasibleReason", containsString("Steady-state error")));
	}

	@Test
	void feasibleRunCarriesNoNearestMiss() throws Exception {
		// reference feedforward cancels the static load, so the response settles
		// and a reachable limit set is satisfiable
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","feedforward":true},
				"gainBounds":{"lower":[0,0],"upper":[40,20]},
				"optimizer":{"type":"GRID_SEARCH","resolution":[7,6]},"objective":{},
				"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":10,"timeStep":0.05},
				"constraints":{"maxControl":50,"maxOvershoot":10,"maxSettlingTime":5,
					"maxSteadyStateError":0.05,"maxControlEnergy":1200}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feasible").value(true))
				.andExpect(jsonPath("$.nearestMiss", nullValue()));
	}

	@Test
	void infeasibleRunNamesTheSearchedRangeInItsReason() throws Exception {
		// kp=0 is in range and commands no force at all, so a single tight peak
		// limit is satisfiable; the settling limit is what closes the last door,
		// since a mass that never moves never enters the band
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
								"optimizer":{"type":"GRID_SEARCH","resolution":[11,6]},"objective":{},
								"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":0.05},
								"constraints":{"maxControl":0.0001,"maxOvershoot":0.0001,"maxSettlingTime":0.0001}}
								""".formatted(SYSTEM)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feasible").value(false))
				.andExpect(jsonPath("$.infeasibleReason", containsString("kp in [0, 30]")))
				.andExpect(jsonPath("$.infeasibleReason", containsString("kd in [0, 10]")))
				// the reason names the limit that actually failed, and stays silent
				// about the two the closest candidate passed
				.andExpect(jsonPath("$.infeasibleReason", containsString("was never reached")))
				.andExpect(jsonPath("$.infeasibleReason", not(containsString("Peak force"))))
				.andExpect(jsonPath("$.infeasibleReason", not(containsString("Max overshoot"))))
				// kp=0 commands no force and never overshoots, so only the settling
				// limit is out of reach for the closest candidate
				.andExpect(jsonPath("$.nearestMiss.violatedConstraints.length()").value(1))
				.andExpect(jsonPath("$.nearestMiss.violatedConstraints[0].id").value("max-settling-time"))
				.andExpect(jsonPath("$.nearestMiss.violatedConstraints[0].achieved").doesNotExist());
	}

	private String withoutElapsedMillis(String response) {
		return response.replaceAll("\"elapsedMillis\":\\d+", "\"elapsedMillis\":0");
	}

	@Test
	void invalidRequestReturnsStructured400() throws Exception {
		String body = """
				{"system":{"type":"SPRING_DAMPER","parameters":{"mass":1,"damping":0.5,"springConstant":10}},
				"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[0,0],"upper":[30,10]},
				"optimizer":{"type":"GRID_SEARCH","resolution":[5,5]},"objective":{},"simulation":{"initialState":[9],"reference":[1,0]}}
				""";
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.message").isNotEmpty());
	}

	@Test
	void negativeTimestepIsRejectedInsteadOfHanging() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},
				"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":-0.05}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.message").value(
						org.hamcrest.Matchers.containsString("timeStep must be a finite positive number")));
	}

	@Test
	void rejectedRecordMessageIsNotWrappedInParserNoise() throws Exception {
		// The client should see the reason, not "Cannot construct instance of ...".
		mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content("""
								{%s,"controller":{"type":"STATE_FEEDBACK"},"gainBounds":{"lower":[5,0],"upper":[1,10]},
								"optimizer":{"type":"GRID_SEARCH","resolution":[3,3]},"objective":{},%s}
								""".formatted(SYSTEM, SIMULATION)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(
						org.hamcrest.Matchers.containsString("Every gain lower bound must be strictly below its upper bound")))
				.andExpect(jsonPath("$.message").value(
						org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("Cannot construct instance"))));
	}

	@Test
	void zeroAndNonFiniteTimestepsAreRejected() throws Exception {
		for (String timeStep : new String[] { "0", "1e-9", "1e400" }) {
			String body = """
					{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},
					"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":%s}}
					""".formatted(SYSTEM, timeStep);
			mockMvc.perform(post("/api/simulations")
							.contentType(MediaType.APPLICATION_JSON).content(body))
					.andExpect(status().isBadRequest());
		}
	}

	@Test
	void endTimeBeforeStartTimeIsRejected() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},
				"simulation":{"initialState":[0,0],"reference":[1,0],"startTime":5,"endTime":1,"timeStep":0.05}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("endTime")));
	}

	@Test
	void nonFiniteStateIsRejected() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},
				"simulation":{"initialState":[1e400,0],"reference":[1,0],"endTime":5,"timeStep":0.05}}
				""".formatted(SYSTEM);
		mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void divergingGainsYield422RatherThanInvalidJson() throws Exception {
		// Gains this large make RK4 leave the finite range inside the horizon. The
		// response must be a clean error, never a body containing a bare NaN token.
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[1e300,0],"tracking":true},
				"simulation":{"initialState":[0,0],"reference":[1,0],"endTime":5,"timeStep":0.05}}
				""".formatted(SYSTEM);
		MvcResult result = mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isUnprocessableEntity())
				.andReturn();
		assertThat(result.getResponse().getContentAsString()).doesNotContain("NaN", "Infinity");
	}

	@Test
	void simulationMetricsAreJsonSafe() throws Exception {
		String body = """
				{%s,"controller":{"type":"STATE_FEEDBACK","gain":[10,5]},
				"simulation":{"initialState":[0,0],"reference":[0,0],"endTime":2,"timeStep":0.05}}
				""".formatted(SYSTEM);
		MvcResult result = mockMvc.perform(post("/api/simulations")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andReturn();
		String json = result.getResponse().getContentAsString();
		assertThat(json).doesNotContain("NaN", "Infinity");
		// A zero reference makes the 2% band zero-width, so settling is undefined.
		assertThat(json).contains("\"settlingTime\":null");
	}

	private String content(String body) throws Exception {
		return mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}
}