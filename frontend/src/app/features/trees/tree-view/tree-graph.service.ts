import { Injectable } from '@angular/core';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { Person, Relationship } from '../../../core/api/api-client.service';

cytoscape.use(dagre);

export interface GraphNode { id: string; label: string; birthYear?: number; sex: string; }

@Injectable({ providedIn: 'root' })
export class TreeGraphService {
  private cy?: cytoscape.Core;

  build(
    container: HTMLElement,
    persons: Person[],
    rels: Relationship[],
    onSelect: (personId: string) => void
  ): cytoscape.Core {
    this.cy?.destroy();

    const nodes = persons.map(p => ({
      data: {
        id: p.id,
        label: `${p.firstName}\n${p.lastName}`,
        sex: p.sex,
        birthYear: p.birth?.year
      }
    }));

    const edges = rels.map(r => ({
      data: {
        id: r.id,
        source: r.fromPersonId,
        target: r.toPersonId,
        type: r.type
      }
    }));

    this.cy = cytoscape({
      container,
      elements: { nodes, edges },
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'text-wrap': 'wrap' as const,
            'text-max-width': '80px',
            color: '#fff',
            'font-size': 10,
            width: 90,
            height: 54,
            shape: 'roundrectangle' as const,
            'background-color': '#4f46e5',
            'border-width': 0,
            'transition-property': 'background-color border-width',
            'transition-duration': '150ms' as any
          }
        },
        {
          selector: 'node[sex = "Male"]',
          style: { 'background-color': '#1d4ed8' }
        },
        {
          selector: 'node[sex = "Female"]',
          style: { 'background-color': '#9d174d' }
        },
        {
          selector: 'node:selected',
          style: { 'background-color': '#7c3aed', 'border-width': 3, 'border-color': '#fff' }
        },
        {
          selector: 'edge[type = "Parent"]',
          style: {
            'line-color': '#94a3b8',
            width: 1.5,
            'target-arrow-shape': 'triangle' as const,
            'target-arrow-color': '#94a3b8',
            'curve-style': 'bezier' as const
          }
        },
        {
          selector: 'edge[type = "Spouse"]',
          style: {
            'line-color': '#e11d48',
            width: 2,
            'line-style': 'dashed' as const,
            'curve-style': 'bezier' as const
          }
        },
        {
          selector: 'edge[type = "Adoptive"]',
          style: {
            'line-color': '#059669',
            width: 1.5,
            'line-style': 'dotted' as const,
            'target-arrow-shape': 'triangle' as const,
            'target-arrow-color': '#059669'
          }
        }
      ],
      layout: {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 40,
        rankSep: 80,
        edgeSep: 10,
        ranker: 'longest-path'
      } as any,
      wheelSensitivity: 0.3
    });

    this.cy.on('tap', 'node', evt => onSelect(evt.target.id()));
    return this.cy;
  }

  highlight(personId: string) {
    this.cy?.$(`#${personId}`).select();
    const node = this.cy?.$(`#${personId}`);
    if (node?.length) {
      this.cy?.animate({ fit: { eles: node, padding: 120 }, duration: 400 });
    }
  }

  fit() { this.cy?.fit(undefined, 40); }
  zoomIn() { if (this.cy) this.cy.zoom(this.cy.zoom() * 1.2); }
  zoomOut() { if (this.cy) this.cy.zoom(this.cy.zoom() / 1.2); }
  destroy() { this.cy?.destroy(); this.cy = undefined; }
}
