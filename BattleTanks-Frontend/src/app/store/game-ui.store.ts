import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

type GameUiState = {
  name: string;
  id: string
  hp: number;
  ammo: number;
  score: number;
  roomId: string;
};

const initialState: GameUiState = {
  name: 'angie-1',
  id: '',
  hp: 100,
  ammo: 10,
  score: 0,
  roomId: '',
};

export const GameUiStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((s) => ({
    isDead: computed(() => s.hp() <= 0),
  })),

  withMethods((s) => ({
    setName(name: string) {
      patchState(s, { name });
    },

    setRoomId(roomId: string) {
      patchState(s, { roomId });
    },

    setId(id: string){
      patchState(s, {id});
    },

    addScore(points: number) {
      patchState(s, { score: s.score() + points });
    },

    damage(amount: number) {
      patchState(s, { hp: Math.max(0, s.hp() - amount) });
    },

    useAmmo(amount: number) {
      patchState(s, { ammo: Math.max(0, s.ammo() - amount) });
    },

    reset() {
      patchState(s, initialState);
    },
  }))
);