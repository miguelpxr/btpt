import { Injectable, inject } from '@angular/core'
import * as signalR from '@microsoft/signalr'
import { Store } from '@ngrx/store'
import { Subject } from 'rxjs'
import { playerMoved, chatReceived, latencySampleAdded, playerJoined } from '../store/players.reducer'
import { AuthService } from './auth.service'

export interface PlayerMoveEvent {
  playerId: string;
  playerName: string;
  direction: 'up' | 'down' | 'left' | 'right';
  timestamp: number;
  x: number;
  y: number;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface BulletFiredEvent {
  shooterId: string;
  bulletId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface BulletHitEvent {
  targetPlayerId: string;
  bulletId: string;
  damage: number;
}

export interface TileDestroyedEvent {
  row: number;
  col: number;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  public connection?: signalR.HubConnection;

  private onPlayerMoveCb?: (evt: PlayerMoveEvent) => void;
  private onChatMessageCb?: (msg: ChatMessage) => void;
  private connectPromise?: Promise<void>;

  public spawnIndex$    = new Subject<number>();
  public bulletFired$   = new Subject<BulletFiredEvent>();
  public bulletHit$     = new Subject<BulletHitEvent>();
  public tileDestroyed$ = new Subject<TileDestroyedEvent>();

  private store = inject(Store)
  private auth  = inject(AuthService)

  async connect(): Promise<void> {
    if (this.connectPromise) return this.connectPromise;

    if (this.connection) {
      if (this.connection.state === signalR.HubConnectionState.Connected) {
        await this.connection.stop();
      }
    }

    this.connectPromise = (async () => {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl('http://localhost:5111/hubs/game', {
          accessTokenFactory: () => this.auth.getToken() || ''
        })
        .withAutomaticReconnect()
        .build();

      this.connection.onclose((e) => console.error('[SignalR] onclose:', e));
      this.connection.onreconnecting((e) => console.warn('[SignalR] reconnecting:', e));
      this.connection.onreconnected((id) => console.log('[SignalR] reconnected:', id));

      this.connection.on('playerMoved', (evt: PlayerMoveEvent) => {
        const ms = Date.now() - evt.timestamp;
        if (Number.isFinite(ms) && ms >= 0) {
          this.store.dispatch(latencySampleAdded({ ms }));
        }
        this.store.dispatch(playerMoved({ event: evt }));
        this.onPlayerMoveCb?.(evt);
      });

      this.connection.on('playerJoined', (data: { playerId: string; playerName: string; spawnIndex: number }) => {
        this.store.dispatch(playerJoined({
          playerId: data.playerId,
          playerName: data.playerName,
          spawnIndex: data.spawnIndex,
        }));
      });

      this.connection.on('chatMessage', (msg: ChatMessage) => {
        this.store.dispatch(chatReceived({ msg }));
        this.onChatMessageCb?.(msg);
      });

      this.connection.on('assignedSpawnIndex', (index: number) => {
        this.spawnIndex$.next(index);
      });

      this.connection.on('bulletFired', (bullet: BulletFiredEvent) => {
        this.bulletFired$.next(bullet);
      });

      this.connection.on('bulletHit', (hit: BulletHitEvent) => {
        this.bulletHit$.next(hit);
      });

      this.connection.on('tileDestroyed', (tile: TileDestroyedEvent) => {
        this.tileDestroyed$.next(tile);
      });

      await this.connection.start();
    })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  async joinRoomGroup(roomId: string): Promise<void> {
    if (!this.connection) throw new Error('[GameService] SignalR no conectado');
    if (this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.connect();
    }
    await this.connection.invoke('JoinRoomGroup', roomId);
  }

  async leaveRoomGroup(roomId: string): Promise<void> {
    if (!this.connection) return;
    if (this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('LeaveRoomGroup', roomId);
  }

  onPlayerMove(callback: (evt: PlayerMoveEvent) => void): void {
    this.onPlayerMoveCb = callback;
  }

  async sendPlayerMove(roomId: string, evt: PlayerMoveEvent): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('PlayerMove', roomId, evt);
  }

  async sendBulletFired(roomId: string, bullet: BulletFiredEvent): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('BulletFired', roomId, bullet);
  }

  async sendBulletHit(roomId: string, hit: BulletHitEvent): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('BulletHit', roomId, hit);
  }

  async sendTileDestroyed(roomId: string, tile: TileDestroyedEvent): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('TileDestroyed', roomId, tile);
  }

  onChatMessage(callback: (msg: ChatMessage) => void): void {
    this.onChatMessageCb = callback;
  }

  async sendChatMessage(roomId: string, msg: ChatMessage): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('SendChatMessage', roomId, msg);
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    await this.connection.stop();
    this.connection = undefined;
  }

  async triggerPowerUp(roomId: string, type: string, x: number, y: number): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('TriggerPowerUp', roomId, type, x, y);
  }

  async triggerCollision(
    roomId: string,
    player1Id: string,
    player2Id: string,
    x: number, 
    y: number, 
    damage: number
  ): Promise<void> {
    if (!this.connection) return;
    await this.connection.invoke('TriggerCollision', roomId, player1Id, player2Id, x, y, damage);
  }
}