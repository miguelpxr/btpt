import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export type MapGrid = number[][];

type MapState = {
  grid: MapGrid;
  tileSize: number;
  loaded: boolean;
};

const initialState: MapState = {
  grid: [],
  tileSize: 48, 
  loaded: false,
};

export const MapStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed(({ grid }) => ({
    rows: computed(() => grid().length),
    cols: computed(() => (grid().length ? grid()[0].length : 0)),
  })),

  withMethods((store) => ({
    loadMap(grid: MapGrid) {
      patchState(store, { grid, loaded: true });
    },

    updateTile(row: number, col: number, value: number) {
      const current = store.grid();
      if (!current.length) return;
      if (row < 0 || col < 0 || row >= current.length || col >= current[row].length) return;

      const next = current.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
      );
      patchState(store, { grid: next });
    },
  }))
);