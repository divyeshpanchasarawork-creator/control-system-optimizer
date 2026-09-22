package org.divyesh.panchasara.control_system_optimizer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.divyesh.panchasara.control_system_optimizer.config.ControlProperties;

@SpringBootApplication
@EnableConfigurationProperties(ControlProperties.class)
public class ControlSystemOptimizerApplication {

	public static void main(String[] args) {
		SpringApplication.run(ControlSystemOptimizerApplication.class, args);
	}

}