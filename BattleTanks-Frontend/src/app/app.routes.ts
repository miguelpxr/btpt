import { Routes } from '@angular/router'

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login').then(m => m.LoginComponent),
  },
  {
    path: 'waiting-room',
    loadComponent: () =>
      import('./waiting-room/waiting-room').then(m => m.WaitingRoom),
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./game/game').then(m => m.GameComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
]
