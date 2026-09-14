import type { StylesheetStyle } from 'cytoscape';
import { COMPACT_H, COMPACT_W, NODE_H, NODE_W } from './node-svg';

/** Diameter of the marriage junction dot rendered between two spouses. */
export const COUPLE_DOT_SIZE = 8;

export interface GraphColors {
  selected: string;
  marriage: string;
  descent: string;
}

/**
 * Pure cytoscape stylesheet builder — no DOM or cytoscape-instance access, so
 * it can be unit tested and re-applied (via `cy.style(...)`) whenever
 * `compact` or the theme palette changes without touching layout or
 * elements.
 *
 * The `background-image` mapping lives on `node[image]`, not the base `node`
 * rule: couple junction nodes carry no `image`/`imageCompact` data, and
 * mapping a missing field there is what produces cytoscape's "no mapping for
 * property background-image" warning for every one of them.
 */
export function graphStylesheet(compact: boolean, colors: GraphColors): StylesheetStyle[] {
  const { selected, marriage, descent } = colors;

  return [
    {
      selector: 'node',
      style: {
        shape: 'roundrectangle',
        width: compact ? COMPACT_W : NODE_W,
        height: compact ? COMPACT_H : NODE_H,
        'background-fit': 'contain',
        'background-clip': 'none',
        'background-opacity': 0,
        'border-width': 0,
        label: '',
        'transition-property': 'opacity',
        'transition-duration': 150
      }
    },
    {
      selector: 'node[image]',
      style: { 'background-image': compact ? 'data(imageCompact)' : 'data(image)' }
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': 2,
        'border-color': selected,
        'overlay-color': selected,
        'overlay-opacity': 0.12,
        'overlay-padding': 6
      }
    },
    { selector: 'node:active', style: { 'overlay-opacity': 0.08 } },
    {
      selector: 'node[?coupleNode]',
      style: {
        width: COUPLE_DOT_SIZE,
        height: COUPLE_DOT_SIZE,
        shape: 'ellipse',
        'background-color': marriage,
        'border-width': 0,
        label: '',
        events: 'no'
      }
    },
    {
      selector: 'edge[ek = "marriage"]',
      style: {
        'line-color': marriage,
        width: 1.5,
        'line-style': 'solid',
        'curve-style': 'straight',
        'source-arrow-shape': 'none',
        'target-arrow-shape': 'none',
        'transition-property': 'opacity',
        'transition-duration': 150
      }
    },
    {
      selector: 'edge[ek = "descent"]',
      style: {
        'line-color': descent,
        width: 1.5,
        'line-style': 'solid',
        'curve-style': 'taxi',
        'taxi-direction': 'downward',
        'taxi-turn': '-40px',
        'source-arrow-shape': 'none',
        'target-arrow-shape': 'none',
        'transition-property': 'opacity',
        'transition-duration': 150
      }
    },
    {
      selector: 'edge[ek = "descent"][relType = "Adoptive"]',
      style: { 'line-style': 'dashed', 'line-color': descent }
    },
    { selector: '.dimmed', style: { opacity: 0.15 } },
    {
      selector: 'node.lineage',
      style: { 'border-width': 2, 'border-color': selected, 'border-opacity': 0.6 }
    }
  ] as StylesheetStyle[];
}
