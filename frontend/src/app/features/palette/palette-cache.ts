import type { TreeDto } from '../../core/api/generated';

/**
 * Session-lifetime cache for the palette's tree list, read and written only by
 * `CommandPaletteComponent` (already a lazy chunk behind `PaletteService`, so caching here
 * costs nothing in the eager bundle). Invalidated by `TreeListComponent` bumping
 * `sessionStorage['qs.treesVersion']` after a create/delete/rename — that component can't
 * import this module eagerly (it isn't itself lazy), so the version tag is the only channel
 * between the two: a cache whose `version` no longer matches the stored one is stale.
 */
export interface PaletteTreeCache { trees: TreeDto[] | null; version: string | null; }

export const paletteTreeCache: PaletteTreeCache = { trees: null, version: null };

export function currentTreesVersion(): string | null {
  try { return sessionStorage.getItem('qs.treesVersion'); } catch { return null; }
}
