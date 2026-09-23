package org.divyesh.panchasara.control_system_optimizer.optimization;

/**
 * One sample of the optimizer's progress: the best objective value found up to
 * a given point of the run.
 *
 * @param generation 0-based progress index (DE: generation; grid search: an
 *                   evaluation milestone)
 * @param bestCost   best objective value seen so far (+INFINITY if none feasible)
 */
public record ConvergencePoint(int generation, double bestCost) {
}