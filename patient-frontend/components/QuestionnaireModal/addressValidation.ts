const PO_BOX_REGEX = /\b(?:p\s*\.?\s*o\s*\.?\s*box|post\s+office\s+box)\b/i;

export const hasPOBox = (...parts: Array<string | null | undefined>): boolean => {
  const combinedAddress = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");

  return PO_BOX_REGEX.test(combinedAddress);
};
