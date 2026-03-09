import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

import { provideStore } from '@ngrx/store';
import { gameReducer } from './store/game.reducer';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptors';
import { playersReducer } from './store/players.reducer';

import { importProvidersFrom } from '@angular/core';
import { MqttModule } from 'ngx-mqtt';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideStore({ game: gameReducer, players: playersReducer }),
    provideHttpClient(withInterceptors([authInterceptor])),

    importProvidersFrom(
      MqttModule.forRoot({
        hostname: 'localhost',
        port: 8083,
        path: '/mqtt',
        protocol: 'ws'
      })
    )
  ],
};
