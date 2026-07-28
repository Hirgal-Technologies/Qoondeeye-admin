/**
 * PostgREST's `.or()` accepts filter syntax as a string. Restricting the
 * search term to ordinary name/description characters prevents user input
 * from becoming part of that syntax.
 */
export function sanitizeTransactionSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function isTransactionUserId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
