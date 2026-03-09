import { gameReducer, initialState } from './game.reducer';
import { playerMoved } from './game.actions';

describe('gameReducer', () => {
  it('should set lastMove on playerMoved', () => {
    const action = playerMoved({
      event: { playerId: 'p1', direction: 'up', timestamp: 123 },
    });
    const state = gameReducer(initialState, action);
    expect(state.lastMove).toEqual({ playerId: 'p1', direction: 'up', timestamp: 123 });
  });
});
