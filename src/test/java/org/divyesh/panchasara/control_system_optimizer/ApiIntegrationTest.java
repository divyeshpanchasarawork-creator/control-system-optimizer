package org.divyesh.panchasara.control_system_optimizer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

	private String content(String body) throws Exception {
		return mockMvc.perform(post("/api/optimization")
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andReturn().getResponse().getContentAsString();
	}
}