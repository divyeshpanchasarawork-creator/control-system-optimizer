package org.divyesh.panchasara.control_system_optimizer.api;

import java.util.List;

import org.divyesh.panchasara.control_system_optimizer.systems.SystemRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SystemCatalogController {

	private final SystemRegistry registry;

	public SystemCatalogController(SystemRegistry registry) {
		this.registry = registry;
	}

	@GetMapping("/systems")
	public List<SystemRegistry.SystemDescriptor> systems() {
		return registry.catalog();
	}
}