import { describe, it, expect, vi } from 'vitest'
import { TestBed } from '@angular/core/testing'
import { WaitingRoom } from './waiting-room'
import { provideHttpClient } from '@angular/common/http'
import { provideRouter } from '@angular/router'
import { of } from 'rxjs'

import { GameService } from '../services/game.service'
import { RoomService } from '../services/room.service'

describe('WaitingRoom', () => {
  it('should create', async () => {
    const gameMock: Partial<GameService> = {
      onChatMessage: vi.fn(),
      onPlayerMove: vi.fn(),
      sendChatMessage: vi.fn().mockResolvedValue(undefined),
      connect: vi.fn().mockResolvedValue(undefined),
    }

    const roomMock: Partial<RoomService> = {
      getRooms: vi.fn(() => of([])),
      createRoom: vi.fn(() => of({ id: 'r1', map: 'desert' } as any)),
      joinRoom: vi.fn(() => of(void 0)),
    }

    await TestBed.configureTestingModule({
      imports: [WaitingRoom],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: GameService, useValue: gameMock },
        { provide: RoomService, useValue: roomMock },
      ],
    }).compileComponents()

    const fixture = TestBed.createComponent(WaitingRoom)
    fixture.detectChanges()

    expect(fixture.componentInstance).toBeTruthy()
  })
})
