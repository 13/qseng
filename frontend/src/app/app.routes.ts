import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth/auth.guard';
import { PersonStore } from './features/persons/person.store';
import { unsavedChangesGuard } from './features/persons/unsaved-changes.guard';
import { TreeStore } from './features/trees/tree-view/tree.store';

export const routes: Routes = [
  { path: '', redirectTo: '/trees', pathMatch: 'full' },
  { path: 'login',    data: { layout: 'auth' }, loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', data: { layout: 'auth' }, loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'trees', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-list.component').then(m => m.TreeListComponent) },
  { path: 'trees/:treeId', canActivate: [authGuard], data: { fullBleed: true }, providers: [TreeStore],
    loadComponent: () => import('./features/trees/tree-view/tree-view.component').then(m => m.TreeViewComponent) },
  { path: 'trees/:treeId/persons/new', canActivate: [authGuard], canDeactivate: [unsavedChangesGuard], providers: [PersonStore],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent) },
  { path: 'trees/:treeId/import', canActivate: [authGuard],
    loadComponent: () => import('./features/import/import-text.component').then(m => m.ImportTextComponent) },
  { path: 'trees/:treeId/search', redirectTo: ({ params, queryParams }) => {
      const q = queryParams['q'];
      return `/trees/${params['treeId']}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    } },
  { path: 'persons/:id', canActivate: [authGuard], providers: [PersonStore],
    loadComponent: () => import('./features/persons/person-detail.component').then(m => m.PersonDetailComponent) },
  { path: 'persons/:id/edit', canActivate: [authGuard], canDeactivate: [unsavedChangesGuard], providers: [PersonStore],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent) },
  { path: 'settings', canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'admin/users', canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-users.component').then(m => m.AdminUsersComponent) },
  { path: '**', redirectTo: '/trees' }
];
