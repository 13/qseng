import { PersonDto } from '../../../core/api/generated';
import { initials, lifespan } from '../../../core/models/person-helpers';

export interface NodeTheme {
  bg: string; border: string; text: string; muted: string;
  male: string; female: string; unknown: string; nameFont: string; textFont: string;
}

export const NODE_W = 180; export const NODE_H = 72; export const COMPACT_W = 120; export const COMPACT_H = 40;

/**
 * Resolves a `light-dark(light, dark)` CSS value to whichever branch matches
 * `dark`; any other value (including a malformed one) passes through
 * unchanged. Splits on the top-level comma only, so a nested function call
 * (e.g. `rgb(0, 0, 0)`) inside either branch is not mistaken for the split.
 */
export function pickLightDark(value: string, dark: boolean): string {
  const m = /^light-dark\((.*)\)$/s.exec(value.trim());
  if (!m) return value;

  const args: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < m[1].length; i++) {
    const c = m[1][i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { args.push(m[1].slice(start, i)); start = i + 1; }
  }
  args.push(m[1].slice(start));
  if (args.length !== 2) return value;

  return args[dark ? 1 : 0].trim();
}

/** True when the page is currently rendering the dark branch of `light-dark()`. */
function isDarkScheme(): boolean {
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (scheme === 'dark') return true;
  if (scheme === 'light') return false;
  // 'light dark' (auto) or unset: fall back to the OS preference, same as the value itself would.
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Reads a CSS custom property off `document.documentElement`, falling back
 * outside a DOM (tests, SSR). Resolves `light-dark()` values: cytoscape (and
 * the standalone SVG documents used for node images) don't evaluate that CSS
 * function themselves, so it must be picked apart here.
 */
export function cssVar(name: string, fallback: string): string {
  if (typeof getComputedStyle !== 'function') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  return pickLightDark(v, isDarkScheme());
}

/** Resolve the graph palette from the active theme's custom properties. */
export function readNodeTheme(): NodeTheme {
  return {
    bg: cssVar('--qs-graph-node-bg', '#fffaf5'), border: cssVar('--qs-graph-node-border', '#c9c2b8'),
    text: cssVar('--mat-sys-on-surface', '#1c1a17'), muted: cssVar('--mat-sys-on-surface-variant', '#5f5a53'),
    male: cssVar('--qs-sex-male', '#5b7a99'), female: cssVar('--qs-sex-female', '#b5636f'), unknown: cssVar('--qs-sex-unknown', '#8a8177'),
    nameFont: 'Fraunces Variable, Georgia, serif', textFont: 'Inter Variable, system-ui, sans-serif'
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hue = (p: PersonDto, t: NodeTheme) => (p.sex === 'Male' ? t.male : p.sex === 'Female' ? t.female : t.unknown);
const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
const toUri = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

function avatar(p: PersonDto, t: NodeTheme, cx: number, cy: number, r: number, font: number): string {
  if (p.avatarUrl) {
    return `<clipPath id="c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="${esc(p.avatarUrl)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hue(p, t)}"/><text x="${cx}" y="${cy + font * 0.36}" text-anchor="middle" font-family="${t.textFont}" font-size="${font}" font-weight="600" fill="#fff">${esc(initials({ firstName: p.firstName ?? '', lastName: p.lastName ?? '' }))}</text>`;
}

/** 180×72 card: stripe, avatar, name (display face), lifespan. */
export function renderNodeSvg(p: PersonDto, t: NodeTheme): string {
  const name = truncate(`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(), 22);
  const span = lifespan({ firstName: '', lastName: '', birth: p.birth, death: p.death });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${NODE_W}" height="${NODE_H}" viewBox="0 0 ${NODE_W} ${NODE_H}">
<rect x="0.5" y="0.5" width="${NODE_W - 1}" height="${NODE_H - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
<rect x="0.5" y="0.5" width="4" height="${NODE_H - 1}" rx="2" fill="${hue(p, t)}"/>
${avatar(p, t, 30, 36, 18, 13)}
<text x="58" y="33" font-family="${t.nameFont}" font-size="14" font-weight="500" fill="${t.text}">${esc(name)}</text>
<text x="58" y="51" font-family="${t.textFont}" font-size="11" fill="${t.muted}">${esc(span)}</text>
</svg>`;
  return toUri(svg);
}

/** 120×40 compact variant for far-out zoom: avatar + surname. */
export function renderCompactNodeSvg(p: PersonDto, t: NodeTheme): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COMPACT_W}" height="${COMPACT_H}" viewBox="0 0 ${COMPACT_W} ${COMPACT_H}">
<rect x="0.5" y="0.5" width="${COMPACT_W - 1}" height="${COMPACT_H - 1}" rx="10" fill="${t.bg}" stroke="${t.border}"/>
<rect x="0.5" y="0.5" width="4" height="${COMPACT_H - 1}" rx="2" fill="${hue(p, t)}"/>
${avatar(p, t, 22, 20, 12, 10)}
<text x="42" y="25" font-family="${t.nameFont}" font-size="13" font-weight="500" fill="${t.text}">${esc(truncate(p.lastName ?? '', 12))}</text>
</svg>`;
  return toUri(svg);
}
