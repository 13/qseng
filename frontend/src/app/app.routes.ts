import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/trees', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent) },
  {
    path: 'trees', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-list.component').then(m => m.TreeListComponent)
  },
  {
    path: 'trees/:treeId', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-view/tree-view.component').then(m => m.TreeViewComponent)
  },
  {
    path: 'trees/:treeId/persons/new', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent)
  },
  {
    path: 'trees/:treeId/import', canActivate: [authGuard],
    loadComponent: () => import('./features/import/import-text.component').then(m => m.ImportTextComponent)
  },
  {
    path: 'trees/:treeId/search', canActivate: [authGuard],
    loadComponent: () => import('./features/trees/tree-search.component').then(m => m.TreeSearchComponent)
  },
  {
    path: 'persons/:id', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-detail.component').then(m => m.PersonDetailComponent)
  },
  {
    path: 'persons/:id/edit', canActivate: [authGuard],
    loadComponent: () => import('./features/persons/person-edit.component').then(m => m.PersonEditComponent)
  },
  { path: '**', redirectTo: '/trees' }
];
