import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GameUiStore } from './game-ui.store';

describe('GameUiStore', () => {
  let store: InstanceType<typeof GameUiStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(GameUiStore);
    store.reset();
  });

  it('debería sumar score con addScore()', () => {
    expect(store.score()).toBe(0);

    store.addScore(10);
    store.addScore(5);

    expect(store.score()).toBe(15);
  });

  it('debería bajar vida con damage() y no dejarla negativa', () => {
    expect(store.hp()).toBe(100);

    store.damage(30);
    expect(store.hp()).toBe(70);

    store.damage(999);
    expect(store.hp()).toBe(0);
  });

  it('debería consumir munición con useAmmo() y no dejarla negativa', () => {
    expect(store.ammo()).toBe(10);

    store.useAmmo(3);
    expect(store.ammo()).toBe(7);

    store.useAmmo(999);
    expect(store.ammo()).toBe(0);
  });
});
