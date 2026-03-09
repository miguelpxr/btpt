import { createFeatureSelector, createSelector } from '@ngrx/store';
import { GameState } from './game.reducer';

export const selectGameState = createFeatureSelector<GameState>('game');

export const selectLastMove = createSelector(
  selectGameState,
  (state) => state.lastMove
);
