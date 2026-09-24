package org.divyesh.panchasara.control_system_optimizer.verification;

/**
 * Cross-validation result: two optimizers searched the same problem and the
 * gap between their best costs is sane, and the reported best candidate is
 * reproducible by a fresh evaluation.
 *
 * @param optimizer         the optimizer that produced this entry
 * @param bestCost          cost at its best candidate
 * @param bestGain          the best gain vector found
 * @param reproducedCost    cost of a fresh evaluation of {@code bestGain}
 * @param gapToBestOther    absolute difference to the better of the two costs
 * @param passed            true when fresh evaluation reproduces the reported
 *                          cost and the optimizer gap stays within tolerance
 */
public record CrossValidationCheck(
		String optimizer,
		double bestCost,
		double[] bestGain,
		double reproducedCost,
		double gapToBestOther,
		boolean passed) {
}