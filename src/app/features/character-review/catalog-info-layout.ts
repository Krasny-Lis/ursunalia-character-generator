/** Pozycjonowanie katalogów i w granicach viewportu oraz nad dolną belką. */
export interface CatalogInfoPosition { top: number; left: number; maxHeight: number; }
export interface CatalogInfoAnchor { top: number; left: number; right: number; }

export function calculateCatalogInfoPosition(
  anchor: CatalogInfoAnchor,
  count: number,
  viewportWidth: number,
  bottom: number,
): CatalogInfoPosition {
  const margin = 14;
  const gap = 10;
  const topLimit = margin;
  const availableHeight = Math.max(0, bottom - topLimit - margin);
  const contentHeight = 95 + count * 135;
  const height = Math.min(520, availableHeight, Math.max(240, contentHeight));
  const width = Math.max(260, Math.min(430, viewportWidth - 2 * margin));
  const rightLeft = anchor.right + gap;
  const leftLeft = anchor.left - width - gap;
  const preferredLeft = rightLeft + width + margin <= viewportWidth
    ? rightLeft : leftLeft >= margin ? leftLeft : anchor.left;
  const left = Math.max(margin, Math.min(preferredLeft, viewportWidth - width - margin));
  const top = Math.max(topLimit, Math.min(anchor.top - 6, bottom - height - margin));
  return { top: Math.round(top), left: Math.round(left), maxHeight: Math.floor(height) };
}
