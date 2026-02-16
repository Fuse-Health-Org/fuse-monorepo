/**
 * Builds the statement descriptor shown on the customer's card/bank statement.
 * Uses only the brand name (no suffix) so it fits in 22 chars and is not truncated.
 * Stripe limit: 22 characters; only [a-zA-Z0-9 ] allowed.
 * HIPAA: Brand name is not PHI.
 */
const STATEMENT_MAX_LENGTH = 22;

/** Returns cleaned brand name only (max 22 chars) for use as full statement_descriptor. */
export function buildStatementDescriptor(brandName: string | null | undefined): string | undefined {
  if (!brandName || typeof brandName !== "string") return undefined;
  const clean = brandName.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (!clean) return undefined;
  return clean.substring(0, STATEMENT_MAX_LENGTH) || undefined;
}

/** Alias for same logic when used as suffix (brand name only to avoid truncation with account prefix). */
export function buildStatementDescriptorSuffix(brandName: string | null | undefined): string | undefined {
  return buildStatementDescriptor(brandName);
}
