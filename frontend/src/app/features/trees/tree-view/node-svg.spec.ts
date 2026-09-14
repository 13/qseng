import { describe, expect, it } from 'vitest';
import { renderCompactNodeSvg, renderNodeSvg, NodeTheme } from './node-svg';

const theme: NodeTheme = { bg: '#fff', border: '#ccc', text: '#111', muted: '#666', male: '#5b7a99', female: '#b5636f', unknown: '#999', nameFont: 'Fraunces Variable', textFont: 'Inter Variable' };
const decode = (uri: string) => decodeURIComponent(uri.replace('data:image/svg+xml;utf8,', ''));

describe('renderNodeSvg', () => {
  it('draws name, lifespan, initials and a sex stripe', () => {
    const svg = decode(renderNodeSvg({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male', birth: { year: 1843 }, death: { year: 1909 } }, theme));
    expect(svg).toContain('width="180"');
    expect(svg).toContain('Konrad Smith');
    expect(svg).toContain('1843 – 1909');
    expect(svg).toContain('>KS<');
    expect(svg).toContain(theme.male);
  });
  it('escapes markup in names and uses the avatar when present', () => {
    const svg = decode(renderNodeSvg({ firstName: 'A<b>', lastName: '&Co', sex: 'Female', avatarUrl: '/u/x.jpg' }, theme));
    expect(svg).toContain('A&lt;b&gt; &amp;Co');
    expect(svg).toContain('href="/u/x.jpg"');
    expect(svg).not.toContain('<b>');
  });
  it('compact variant is 120x40 and shows surname only', () => {
    const svg = decode(renderCompactNodeSvg({ firstName: 'Konrad', lastName: 'Smith', sex: 'Male' }, theme));
    expect(svg).toContain('width="120"');
    expect(svg).toContain('>Smith<');
    expect(svg).not.toContain('Konrad');
  });
});
