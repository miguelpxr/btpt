import { createAction, props } from '@ngrx/store';
import { PlayerMoveEvent } from '../services/game.service';

export const playerMoved = createAction(
  '[Game] Player Moved',
  props<{ event: PlayerMoveEvent }>()
);
