import { createReducer, on } from '@ngrx/store';
import { PlayerMoveEvent } from '../services/game.service';
import { playerMoved } from './game.actions';

export type GameState = {
  lastMove: PlayerMoveEvent | null;
};

export const initialState: GameState = {
  lastMove: null,
};

export const gameReducer = createReducer(
  initialState,
  on(playerMoved, (state, { event }) => ({
    ...state,
    lastMove: event,
  }))
);
