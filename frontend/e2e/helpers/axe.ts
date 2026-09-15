import path from 'node:path';
import { Page, expect, test } from '@playwright/test';

const AXE_SCRIPT = path.resolve(__dirname, '../../node_modules/axe-core/axe.min.js');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  help: string;
  nodes: unknown[];
}

interface AxeResults {
  violations: AxeViolation[];
}

declare global {
  interface Window {
    axe: { run(context: Document, options: unknown): Promise<AxeResults> };
  }
}

/** Runs axe-core against the current page, attaches the full report to the test, and
 * fails on any serious/critical violation. */
export async function axeCheck(page: Page, name: string): Promise<void> {
  await page.addScriptTag({ path: AXE_SCRIPT });

  const results = await page.evaluate(
    tags => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    AXE_TAGS
  );

  await test.info().attach(`axe-${name}`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });

  const seriousOrCritical = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(seriousOrCritical).toEqual([]);
}
