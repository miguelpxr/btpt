import {
  playersReducer,
  initialPlayersState,
  playerMoved,
  selectPlayersList,
  selectPlayerById,
} from './players.reducer'

describe('playersReducer', () => {
  it('debería crear un jugador si no existe y moverlo a la derecha', () => {
    const action = playerMoved({
      event: { playerId: 'p1', direction: 'right', timestamp: 123 },
    })

    const state = playersReducer(initialPlayersState, action)

    expect(state.entities['p1']).toBeTruthy()
    expect(state.entities['p1'].x).toBe(103)
    expect(state.entities['p1'].y).toBe(100)
  })

  it('debería mover un jugador existente hacia arriba', () => {
    const prevState = {
      entities: {
        p1: { id: 'p1', name: 'p1', x: 50, y: 50, hp: 100, lastSeen: 1 },
      },
    }

    const action = playerMoved({
      event: { playerId: 'p1', direction: 'up', timestamp: 999 },
    })

    const state = playersReducer(prevState as any, action)

    expect(state.entities['p1'].x).toBe(50)
    expect(state.entities['p1'].y).toBe(47)
  })
})

describe('players selectors', () => {
  it('selectPlayersList debería devolver una lista con los jugadores', () => {
    const rootState = {
      players: {
        entities: {
          p1: { id: 'p1', name: 'p1', x: 1, y: 2, hp: 100, lastSeen: 1 },
          p2: { id: 'p2', name: 'p2', x: 3, y: 4, hp: 100, lastSeen: 2 },
        },
      },
    } as any

    const list = selectPlayersList(rootState)

    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(2)
    expect(list.map((p: any) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('selectPlayerById debería devolver el jugador correcto', () => {
    const rootState = {
      players: {
        entities: {
          p1: { id: 'p1', name: 'p1', x: 1, y: 2, hp: 100, lastSeen: 1 },
        },
      },
    } as any

    const selector = selectPlayerById('p1')
    const p1 = selector(rootState)

    expect(p1).toBeTruthy()
    expect(p1.id).toBe('p1')
    expect(p1.x).toBe(1)
  })
})
