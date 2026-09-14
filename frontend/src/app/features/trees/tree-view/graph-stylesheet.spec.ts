import type { StylesheetStyle } from 'cytoscape';
import { describe, expect, it } from 'vitest';
import { COMPACT_H, COMPACT_W, NODE_H, NODE_W } from './node-svg';
import { graphStylesheet } from './graph-stylesheet';

const colors = { selected: '#111111', marriage: '#222222', descent: '#333333' };

function ruleFor(sheet: StylesheetStyle[], selector: string): Record<string, unknown> {
  const rule = sheet.find(s => s.selector === selector);
  if (!rule) throw new Error(`no rule for selector "${selector}"`);
  return rule.style as unknown as Record<string, unknown>;
}

describe('graphStylesheet', () => {
  it('sizes the full card and maps data(image) when not compact', () => {
    const sheet = graphStylesheet(false, colors);
    const node = ruleFor(sheet, 'node');
    expect(node['width']).toBe(NODE_W);
    expect(node['height']).toBe(NODE_H);
    expect(ruleFor(sheet, 'node[image]')['background-image']).toBe('data(image)');
  });

  it('sizes the compact card and maps data(imageCompact) when compact', () => {
    const sheet = graphStylesheet(true, colors);
    const node = ruleFor(sheet, 'node');
    expect(node['width']).toBe(COMPACT_W);
    expect(node['height']).toBe(COMPACT_H);
    expect(ruleFor(sheet, 'node[image]')['background-image']).toBe('data(imageCompact)');
  });

  it('keeps the background-image mapping off the base node rule (couple nodes have no image data)', () => {
    const sheet = graphStylesheet(false, colors);
    expect(ruleFor(sheet, 'node')['background-image']).toBeUndefined();
  });

  it('passes the selected/marriage/descent colours through', () => {
    const sheet = graphStylesheet(false, colors);
    expect(ruleFor(sheet, 'node:selected')['border-color']).toBe(colors.selected);
    expect(ruleFor(sheet, 'node:selected')['overlay-color']).toBe(colors.selected);
    expect(ruleFor(sheet, 'node[?coupleNode]')['background-color']).toBe(colors.marriage);
    expect(ruleFor(sheet, 'edge[ek = "marriage"]')['line-color']).toBe(colors.marriage);
    expect(ruleFor(sheet, 'edge[ek = "descent"]')['line-color']).toBe(colors.descent);
    expect(ruleFor(sheet, 'node.lineage')['border-color']).toBe(colors.selected);
  });
});
