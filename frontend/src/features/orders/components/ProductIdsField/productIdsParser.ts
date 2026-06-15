export function parseProductIds(value: string): string[] {
  const seen = new Set<string>();
  const productIds: string[] = [];

  value
    .split(/[,\n\r]+/)
    .map((productId) => productId.trim())
    .filter(Boolean)
    .forEach((productId) => {
      if (seen.has(productId)) {
        return;
      }

      seen.add(productId);
      productIds.push(productId);
    });

  return productIds;
}
