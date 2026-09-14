import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PersonsApi } from '../../core/api/generated';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService, Lang } from '../../core/i18n/i18n.service';
import { TranslationKey } from '../../core/i18n/translation-keys';
import { ThemeService } from '../../core/theme/theme.service';
import { PaletteService } from '../../core/ui/palette.service';
import type { RelationshipDialogData } from '../persons/relationship-dialog.component';

export interface PaletteContext {
  treeId: string | null;
  isAdmin: boolean;
  lang: 'de' | 'en';
  theme: 'light' | 'dark' | 'auto';
}

export interface PaletteAction {
  id: string;
  labelKey: TranslationKey;
  icon: string;
  run: (ctx: PaletteContext) => void;
  available: (ctx: PaletteContext) => boolean;
}

/**
 * Dependencies for the palette's actions. Mirrors the services a component
 * opening these actions from a dialog would otherwise inject itself, so the
 * list stays a plain, dependency-injection-free function that is trivial to
 * unit test with hand-built mocks.
 *
 * `personsApi` and `paletteService` are not part of the original P2b task
 * brief's `deps` shape; they were added because `addRelation` needs a fresh
 * person list before opening the relationship dialog, and `shortcuts` needs
 * somewhere to route to (see the P2b Task 2 report for details).
 */
export interface PaletteActionDeps {
  router: Router;
  theme: ThemeService;
  i18n: I18nService;
  auth: AuthService;
  dialog: MatDialog;
  setLang: (l: Lang) => void;
  personsApi: PersonsApi;
  paletteService: PaletteService;
}

const withTree = (ctx: PaletteContext) => !!ctx.treeId;

export function paletteActions(deps: PaletteActionDeps): PaletteAction[] {
  return [
    {
      id: 'addPerson', labelKey: 'palette.action.addPerson', icon: 'person_add',
      available: withTree,
      run: ctx => { void deps.router.navigate(['/trees', ctx.treeId, 'persons', 'new']); }
    },
    {
      id: 'addRelation', labelKey: 'palette.action.addRelation', icon: 'group_add',
      available: withTree,
      run: async ctx => {
        const treeId = ctx.treeId;
        if (!treeId) return;
        const persons = await firstValueFrom(deps.personsApi.personsGetByTree({ treeId })).catch(() => []);
        const { RelationshipDialogComponent } = await import('../persons/relationship-dialog.component');
        const data: RelationshipDialogData = { treeId, persons, mode: 'new' };
        deps.dialog.open(RelationshipDialogComponent, { data, width: '520px', maxWidth: '95vw' });
      }
    },
    {
      id: 'import', labelKey: 'palette.action.import', icon: 'upload_file',
      available: withTree,
      run: ctx => { void deps.router.navigate(['/trees', ctx.treeId, 'import']); }
    },
    {
      id: 'newTree', labelKey: 'palette.action.newTree', icon: 'add',
      available: () => true,
      run: () => { void deps.router.navigate(['/trees'], { queryParams: { new: 1 } }); }
    },
    {
      id: 'trees', labelKey: 'palette.action.trees', icon: 'forest',
      available: () => true,
      run: () => { void deps.router.navigate(['/trees']); }
    },
    {
      id: 'settings', labelKey: 'palette.action.settings', icon: 'settings',
      available: () => true,
      run: () => { void deps.router.navigate(['/settings']); }
    },
    {
      id: 'themeLight', labelKey: 'palette.action.themeLight', icon: 'light_mode',
      available: () => true,
      run: () => deps.theme.setMode('light')
    },
    {
      id: 'themeDark', labelKey: 'palette.action.themeDark', icon: 'dark_mode',
      available: () => true,
      run: () => deps.theme.setMode('dark')
    },
    {
      id: 'themeAuto', labelKey: 'palette.action.themeAuto', icon: 'brightness_auto',
      available: () => true,
      run: () => deps.theme.setMode('auto')
    },
    {
      id: 'langDe', labelKey: 'palette.action.langDe', icon: 'translate',
      available: () => true,
      run: () => deps.setLang('de')
    },
    {
      id: 'langEn', labelKey: 'palette.action.langEn', icon: 'translate',
      available: () => true,
      run: () => deps.setLang('en')
    },
    {
      id: 'users', labelKey: 'palette.action.users', icon: 'group',
      available: ctx => ctx.isAdmin,
      run: () => { void deps.router.navigate(['/admin/users']); }
    },
    {
      id: 'shortcuts', labelKey: 'palette.action.shortcuts', icon: 'keyboard',
      available: () => true,
      run: () => { void deps.paletteService.openShortcuts(); }
    },
    {
      id: 'logout', labelKey: 'palette.action.logout', icon: 'logout',
      available: () => true,
      run: () => { deps.auth.logout(); void deps.router.navigate(['/login']); }
    }
  ];
}
