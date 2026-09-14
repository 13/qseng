import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/trees', pathMatch: 'full' },
  { path: 'login',    data: { layout: 'auth' }, loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', data: { layout: 'auth' }, loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  { path: 'trees', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-list.component').then(m => m.TreeListComponent) },
  { path: 'trees/:treeId', canActivate: [authGuard], data: { fullBleed: true },
    loadComponent: () => import('./features/trees/tree-view/tree-view.component').then(m => m.TreeViewComponent) },
  { path: 'trees/:treeId/persons/new', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent) },
  { path: 'trees/:treeId/import', canActivate: [authGuard],
    loadComponent: () => import('./features/import/import-text.component').then(m => m.ImportTextComponent) },
  { path: 'trees/:treeId/search', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-search.component').then(m => m.TreeSearchComponent) },
  { path: 'persons/:id', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-detail.component').then(m => m.PersonDetailComponent) },
  { path: 'persons/:id/edit', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent) },
  { path: 'settings', canActivate: [authGuard],
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
  { path: 'admin/users', canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-users.component').then(m => m.AdminUsersComponent) },
  { path: '**', redirectTo: '/trees' }
];
