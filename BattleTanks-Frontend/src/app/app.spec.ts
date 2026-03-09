import { TestBed } from '@angular/core/testing'
import { provideStore } from '@ngrx/store'
import { App } from './app'
import { gameReducer } from './store/game.reducer'
import { playersReducer } from './store/players.reducer'
import { GameService } from './services/game.service'

describe('App', () => {
  beforeEach(async () => {
    const gameMock: Partial<GameService> = {
      connect: async () => {},
      sendPlayerMove: async () => {},
      onPlayerMove: () => {},
      onChatMessage: () => {},
      sendChatMessage: async () => {},
      disconnect: async () => {},
    }

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideStore({ game: gameReducer, players: playersReducer }),
        { provide: GameService, useValue: gameMock },
      ],
    }).compileComponents()
  })

  it('should render router outlet', () => {
  const fixture = TestBed.createComponent(App)
  fixture.detectChanges()
  const compiled = fixture.nativeElement as HTMLElement

  expect(compiled.querySelector('router-outlet')).toBeTruthy()
})

 
})
