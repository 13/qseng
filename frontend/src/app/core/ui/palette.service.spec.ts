import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NEVER } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaletteService, paletteLoader } from './palette.service';
import { I18nService } from '../i18n/i18n.service';

describe('PaletteService', () => {
  const originalPalette = paletteLoader.palette;
  const originalDialog = paletteLoader.dialog;

  afterEach(() => {
    paletteLoader.palette = originalPalette;
    paletteLoader.dialog = originalDialog;
    document.body.innerHTML = '';
  });

  function setup() {
    TestBed.resetTestingModule();
    // Real `@angular/material/dialog` module (cheap, needed so the `MatDialog` class the
    // service resolves via the injector is the same identity as the one provided below);
    // the palette component chunk itself is stubbed out — it drags in PersonsApi/TreesApi
    // and friends, none of which this spec needs since `dialog.open` below is a mock.
    paletteLoader.dialog = () => import('@angular/material/dialog');
    paletteLoader.palette = (() => Promise.resolve({ CommandPaletteComponent: class {} })) as typeof paletteLoader.palette;

    // Never emits on its own, unlike a real MatDialogRef — this spec only cares whether
    // `close()` was asked for, not that `this.ref` resets itself back to null afterwards.
    const dialogRef = { afterClosed: () => NEVER, close: vi.fn() };
    const dialog = { open: vi.fn(() => dialogRef) };
    TestBed.configureTestingModule({ providers: [
      { provide: MatDialog, useValue: dialog },
      { provide: I18nService, useValue: { t: (k: string) => k } }
    ] });
    const service = TestBed.inject(PaletteService);
    return { service, dialog, dialogRef };
  }

  it('opens once for two rapid calls', async () => {
    const { service, dialog } = setup();
    const first = service.open();
    const second = service.open();
    await Promise.all([first, second]);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('a second call once open closes it instead of opening another', async () => {
    const { service, dialog, dialogRef } = setup();
    await service.open();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    await service.open();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it('does not open when a global overlay wrapper already exists', async () => {
    const { service, dialog } = setup();
    document.body.innerHTML = '<div class="cdk-overlay-container"><div class="cdk-global-overlay-wrapper"></div></div>';
    await service.open();
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
