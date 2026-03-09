import {
  createAction,
  createFeatureSelector,
  createReducer,
  createSelector,
  on,
  props,
} from '@ngrx/store'
import { PlayerMoveEvent, ChatMessage } from '../services/game.service'
import { Player } from '../models/player.model'

export const playerMoved = createAction(
  '[Players] Player Moved',
  props<{ event: PlayerMoveEvent }>()
)

export const playerJoined = createAction(
  '[Players] Player Joined',
  props<{ playerId: string; playerName: string; spawnIndex: number }>()
)

export const chatReceived = createAction(
  '[Chat] Message Received',
  props<{ msg: ChatMessage }>()
)

export const latencySampleAdded = createAction(
  '[Perf] Latency Sample Added',
  props<{ ms: number }>()
)

export type PlayersState = {
  entities: Record<string, Player>
  chat: ChatMessage[]
  perf: { latencyMs: number[] }
}

export const initialPlayersState: PlayersState = {
  entities: {},
  chat: [],
  perf: { latencyMs: [] },
}

const MAX_CHAT    = 50
const MAX_SAMPLES = 200

export const playersReducer = createReducer(
  initialPlayersState,

  on(playerJoined, (state, { playerId, playerName, spawnIndex }) => {
    if (state.entities[playerId]) return state;
    return {
      ...state,
      entities: {
        ...state.entities,
        [playerId]: {
          id: playerId,
          name: playerName,
          x: 0,
          y: 0,
          hp: 100,
          lastSeen: Date.now(),
          spawnIndex,
        },
      },
    };
  }),

  on(playerMoved, (state, { event }) => {
    const current: Player = state.entities[event.playerId] ?? {
      id:         event.playerId,
      name:       (event as any).playerName ?? event.playerId,
      x:          event.x,
      y:          event.y,
      hp:         100,
      lastSeen:   Date.now(),
      spawnIndex: 0,
    };

    return {
      ...state,
      entities: {
        ...state.entities,
        [event.playerId]: {
          ...current,
          name:     (event as any).playerName ?? current.name,
          x:        event.x,
          y:        event.y,
          lastSeen: Date.now(),
        },
      },
    };
  }),

  on(chatReceived, (state, { msg }) => ({
    ...state,
    chat: [...state.chat, msg].slice(-MAX_CHAT),
  })),

  on(latencySampleAdded, (state, { ms }) => ({
    ...state,
    perf: {
      ...state.perf,
      latencyMs: [...state.perf.latencyMs, ms].slice(-MAX_SAMPLES),
    },
  }))
)

export const selectPlayersState    = createFeatureSelector<PlayersState>('players')
export const selectPlayersEntities = createSelector(selectPlayersState, (s) => s.entities)
export const selectPlayersList     = createSelector(selectPlayersEntities, (e) => Object.values(e))
export const selectPlayerById      = (id: string) => createSelector(selectPlayersEntities, (e) => e[id])
export const selectChatHistory     = createSelector(selectPlayersState, (s) => s.chat)
export const selectLatencySamples  = createSelector(selectPlayersState, (s) => s.perf.latencyMs)

export const selectLatencyStats = createSelector(selectLatencySamples, (arr) => {
  if (!arr.length) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const p      = (q: number) => sorted[Math.floor(q * (sorted.length - 1))]
  const avg    = sorted.reduce((sum, x) => sum + x, 0) / sorted.length
  return { n: sorted.length, min: sorted[0], p50: p(0.5), p95: p(0.95), max: sorted[sorted.length - 1], avg }
})
