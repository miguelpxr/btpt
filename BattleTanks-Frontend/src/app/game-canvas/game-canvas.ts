import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Store } from '@ngrx/store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Tank } from '../models/tank.model';
import { Player } from '../models/player.model';
import { GameUiStore } from '../store/game-ui.store';
import { MapStore } from '../store/map.store';
import { GameService, PlayerMoveEvent, ChatMessage, BulletFiredEvent, BulletHitEvent, TileDestroyedEvent } from '../services/game.service';
import { MqttGameService, PowerUpEvent, CollisionEvent } from '../services/mqtt-game.service';
import {
  selectPlayersList,
  playerMoved as playerMovedPlayers,
  selectChatHistory,
  selectLatencyStats,
  latencySampleAdded,
} from '../store/players.reducer';

type MapGrid = number[][];
type Explosion = { x: number; y: number; t: number };

const TANK_W = 32;
const TANK_H = 32;
const BULLET_SPEED = 6;
const BULLET_DAMAGE = 10;

const PLAYER_COLORS = [
  { body: '#4fffb0', turret: '#1dc98a', cannon: '#1dc98a' },
  { body: '#74b9ff', turret: '#2d7fe0', cannon: '#2d7fe0' },
  { body: '#ffd166', turret: '#d4a017', cannon: '#d4a017' },
  { body: '#ff6fa8', turret: '#cc2060', cannon: '#cc2060' },
];

const SPAWN_CELLS = [
  { col: 2,  row: 2  },
  { col: 12, row: 2  },
  { col: 2,  row: 13 },
  { col: 12, row: 13 },
];

interface SyncedBullet {
  id: string;
  shooterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

@Component({
  selector: 'app-game-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game-canvas.html',
  styleUrl: './game-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private http     = inject(HttpClient);
  private store    = inject(Store);
  private game     = inject(GameService);
  private ui       = inject(GameUiStore);
  private mapStore = inject(MapStore);
  private mqttGame = inject(MqttGameService);
  private cdr      = inject(ChangeDetectorRef);

  private playersSnapshot: Player[] = [];
  private playersSub?: Subscription;
  private chatSub?: Subscription;
  private perfSub?: Subscription;
  private subscriptions: Subscription[] = [];

  private playerIndex = -1;
  private spawnReady  = false;

  chatText     = '';
  chatSnapshot: ChatMessage[] = [];
  latencyStats: any = null;

  powerUpsOnScreen:   Array<{ x: number; y: number; type: string; id: string }> = [];
  collisionsOnScreen: Array<{ x: number; y: number; timestamp: number }>        = [];

  private ctx!: CanvasRenderingContext2D;
  private explosions: Explosion[]   = [];
  private localBullets: SyncedBullet[]  = [];
  private remoteBullets: SyncedBullet[] = [];

  tank: Tank = {
    x: 0, y: 0,
    w: TANK_W, h: TANK_H,
    speed: 3, dir: 'right',
    hp: 100, state: 'active', damageFrames: 0,
  };

  private playerId      = this.ui.id();
  private playerName    = this.ui.name();
  private currentRoomId = this.ui.roomId;
  private keys          = new Set<string>();
  private rafId: number | null = null;

  private keyDownHandler = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'spacebar') { if (!e.repeat) this.fireLocalBullet(); return; }
    this.keys.add(key);
  };
  private keyUpHandler = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  ngAfterViewInit(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup',   this.keyUpHandler);

    this.subscriptions.push(
      this.game.spawnIndex$.subscribe(index => {
        this.playerIndex = index;
        if (this.mapStore.loaded()) {
          this.applySpawn();
        } else {
          this.spawnReady = true;
        }
      })
    );

    this.subscriptions.push(
      this.game.bulletFired$.subscribe(b => this.handleRemoteBullet(b))
    );

    this.subscriptions.push(
      this.game.bulletHit$.subscribe(h => this.handleBulletHit(h))
    );

    this.subscriptions.push(
      this.game.tileDestroyed$.subscribe(t => {
        this.mapStore.updateTile(t.row, t.col, 0);
      })
    );

    this.loadMap();
    this.loop();

    this.playersSub = this.store.select(selectPlayersList).subscribe(list => {
      this.playersSnapshot = list;
    });

    this.chatSub = this.store.select(selectChatHistory).subscribe(list => {
      this.chatSnapshot = list;
      this.cdr.markForCheck();
    });

    this.perfSub = this.store.select(selectLatencyStats).subscribe(stats => {
      this.latencyStats = stats;
      this.cdr.markForCheck();
    });

    const roomId = this.currentRoomId();
    if (roomId) {
      this.mqttGame.subscribeToPowerUps(roomId);
      this.subscriptions.push(this.mqttGame.powerUp$.subscribe(p => this.handlePowerUp(p)));

      this.mqttGame.subscribeToCollisions(roomId);
      this.subscriptions.push(this.mqttGame.collision$.subscribe(c => this.handleCollision(c)));

      this.mqttGame.subscribeToGameEnd(roomId);
      this.subscriptions.push(this.mqttGame.gameEnd$.subscribe(g =>
        alert(`¡Juego terminado!\n\nGanador: ${g.winnerName}\nPuntos: ${g.finalScore}`)
      ));
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup',   this.keyUpHandler);
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.playersSub?.unsubscribe();
    this.chatSub?.unsubscribe();
    this.perfSub?.unsubscribe();
    this.subscriptions.forEach(s => s.unsubscribe());
    const roomId = this.currentRoomId();
    if (roomId) this.mqttGame.unsubscribeFromRoom(roomId);
  }

  private applySpawn(): void {
    if (this.playerIndex < 0) return;
    const ts   = this.mapStore.tileSize();
    const cell = SPAWN_CELLS[Math.min(this.playerIndex, SPAWN_CELLS.length - 1)];
    this.tank.x = cell.col * ts + (ts - TANK_W) / 2;
    this.tank.y = cell.row * ts + (ts - TANK_H) / 2;

    const roomId = this.currentRoomId();
    if (roomId) {
      setTimeout(() => {
        const evt: PlayerMoveEvent = {
          playerId:   this.playerId,
          playerName: this.playerName,
          direction:  this.tank.dir as PlayerMoveEvent['direction'],
          timestamp:  Date.now(),
          x: this.tank.x,
          y: this.tank.y,
        };
        this.store.dispatch(playerMovedPlayers({ event: evt }));
        this.game.sendPlayerMove(roomId, evt)
          .catch(err => console.error('[Canvas] initial position error:', err));
      }, 300);
    }
  }

  private loop = () => {
    this.update();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(): void {
    const canvas = this.canvasRef.nativeElement;

    if (this.tank.hp <= 0) { this.tank.hp = 0; this.tank.state = 'destroyed'; }
    if (this.tank.damageFrames > 0) this.tank.damageFrames -= 1;

    const up    = this.keys.has('w') || this.keys.has('arrowup');
    const down  = this.keys.has('s') || this.keys.has('arrowdown');
    const left  = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');

    if (this.tank.state === 'active') {
      let dx = 0, dy = 0;
      if (up)    { dy -= this.tank.speed; this.tank.dir = 'up';    }
      if (down)  { dy += this.tank.speed; this.tank.dir = 'down';  }
      if (left)  { dx -= this.tank.speed; this.tank.dir = 'left';  }
      if (right) { dx += this.tank.speed; this.tank.dir = 'right'; }

      const prevX = this.tank.x, prevY = this.tank.y;
      const nextX = Math.max(0, Math.min(prevX + dx, canvas.width  - TANK_W));
      const nextY = Math.max(0, Math.min(prevY + dy, canvas.height - TANK_H));

      if (this.canMoveTo(nextX, nextY)) {
        this.tank.x = nextX; this.tank.y = nextY;
      } else {
        const tryX = Math.max(0, Math.min(prevX + dx, canvas.width  - TANK_W));
        if (this.canMoveTo(tryX, prevY)) this.tank.x = tryX;
        const tryY = Math.max(0, Math.min(prevY + dy, canvas.height - TANK_H));
        if (this.canMoveTo(this.tank.x, tryY)) this.tank.y = tryY;
      }

      if (this.tank.x !== prevX || this.tank.y !== prevY) {
        const evt: PlayerMoveEvent = {
          playerId:   this.playerId,
          playerName: this.playerName,
          direction:  this.tank.dir as PlayerMoveEvent['direction'],
          timestamp:  Date.now(),
          x: this.tank.x,
          y: this.tank.y,
        };
        this.store.dispatch(playerMovedPlayers({ event: evt }));
        const roomId = this.currentRoomId();
        if (roomId) this.game.sendPlayerMove(roomId, evt)
          .catch(err => console.error('[Canvas] sendPlayerMove error:', err));
      }
    }

    this.updateLocalBullets(canvas);
    this.updateRemoteBullets(canvas);

    for (const ex of this.explosions) ex.t -= 1;
    this.explosions = this.explosions.filter(ex => ex.t > 0);

    this.collisionsOnScreen = this.collisionsOnScreen.filter(
      c => Date.now() - c.timestamp < 1000
    );
  }

  private updateLocalBullets(canvas: HTMLCanvasElement): void {
    const next: SyncedBullet[] = [];
    for (const b of this.localBullets) {
      const nb = { ...b, x: b.x + b.vx, y: b.y + b.vy };

      if (nb.x < 0 || nb.y < 0 || nb.x > canvas.width || nb.y > canvas.height) continue;

      if (this.mapStore.loaded()) {
        const ts   = this.mapStore.tileSize();
        const row  = Math.floor(nb.y / ts);
        const col  = Math.floor(nb.x / ts);
        const grid = this.mapStore.grid();
        if (row >= 0 && col >= 0 && row < grid.length && col < grid[row].length) {
          const tile = grid[row][col];
          if (tile === 1) {
            this.spawnExplosion(col * ts + ts / 2, row * ts + ts / 2, 6);
            continue;
          }
          if (tile === 2) {
            this.mapStore.updateTile(row, col, 0);
            this.spawnExplosion(col * ts + ts / 2, row * ts + ts / 2, 10);
            const roomId = this.currentRoomId();
            if (roomId) {
              this.game.sendTileDestroyed(roomId, { row, col })
                .catch(err => console.error('[Canvas] sendTileDestroyed error:', err));
            }
            continue;
          }
        }
      }

      let hitPlayer = false;
      for (const p of this.playersSnapshot) {
        if (p.id === this.playerId) continue;
        if (nb.x > p.x && nb.x < p.x + TANK_W && nb.y > p.y && nb.y < p.y + TANK_H) {
          this.spawnExplosion(nb.x, nb.y, 10);
          const roomId = this.currentRoomId();
          if (roomId) {
            const hit: BulletHitEvent = { targetPlayerId: p.id, bulletId: nb.id, damage: BULLET_DAMAGE };
            this.game.sendBulletHit(roomId, hit)
              .catch(err => console.error('[Canvas] sendBulletHit error:', err));
          }
          hitPlayer = true;
          break;
        }
      }

      if (!hitPlayer) next.push(nb);
    }
    this.localBullets = next;
  }

  private updateRemoteBullets(canvas: HTMLCanvasElement): void {
    const next: SyncedBullet[] = [];
    for (const b of this.remoteBullets) {
      const nb = { ...b, x: b.x + b.vx, y: b.y + b.vy };

      if (nb.x < 0 || nb.y < 0 || nb.x > canvas.width || nb.y > canvas.height) continue;

      if (this.mapStore.loaded()) {
        const ts   = this.mapStore.tileSize();
        const row  = Math.floor(nb.y / ts);
        const col  = Math.floor(nb.x / ts);
        const grid = this.mapStore.grid();
        if (row >= 0 && col >= 0 && row < grid.length && col < grid[row].length) {
          const tile = grid[row][col];
          if (tile === 1 || tile === 2) {
            this.spawnExplosion(col * ts + ts / 2, row * ts + ts / 2, 6);
            continue;
          }
        }
      }

      next.push(nb);
    }
    this.remoteBullets = next;
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#0d0520';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.drawMap();
    this.drawSpawnZones();
    this.drawExplosions();
    this.drawAllBullets();
    this.drawOtherPlayers();
    this.drawTank();
    this.drawPowerUps();
    this.drawCollisions();
  }

  private loadMap(): void {
    this.http.get<MapGrid>('maps/map1.json').subscribe({
      next: (grid) => {
        this.mapStore.loadMap(grid);
        const ts     = this.mapStore.tileSize();
        const canvas = this.canvasRef.nativeElement;
        canvas.width  = (grid[0]?.length ?? 0) * ts;
        canvas.height = grid.length * ts;

        if (this.spawnReady) {
          this.applySpawn();
          this.spawnReady = false;
        }
      },
      error: (err) => console.error('Error cargando mapa:', err),
    });
  }

  private drawMap(): void {
    const grid = this.mapStore.grid();
    if (!this.mapStore.loaded() || !grid.length) return;
    const ts = this.mapStore.tileSize();
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] === 1) this.drawMetalTile(c * ts, r * ts);
        if (grid[r][c] === 2) this.drawBrickTile(c * ts, r * ts);
      }
  }

  private drawSpawnZones(): void {
    if (!this.mapStore.loaded()) return;
    const ts = this.mapStore.tileSize();
    SPAWN_CELLS.forEach((cell, i) => {
      this.ctx.save();
      this.ctx.globalAlpha = 0.12;
      this.ctx.fillStyle   = PLAYER_COLORS[i].body;
      this.ctx.fillRect(cell.col * ts, cell.row * ts, ts, ts);
      this.ctx.globalAlpha = 0.5;
      this.ctx.strokeStyle = PLAYER_COLORS[i].body;
      this.ctx.lineWidth   = 1.5;
      this.ctx.strokeRect(cell.col * ts + 1, cell.row * ts + 1, ts - 2, ts - 2);
      this.ctx.globalAlpha = 1;
      this.ctx.restore();
    });
  }

  private drawMetalTile(x: number, y: number): void {
    const ts = this.mapStore.tileSize();
    this.ctx.fillStyle   = '#4a4060';
    this.ctx.fillRect(x, y, ts, ts);
    this.ctx.strokeStyle = '#2d1f4e';
    this.ctx.lineWidth   = 2;
    this.ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
    this.ctx.fillStyle = 'rgba(196,75,255,0.18)';
    this.ctx.fillRect(x + 6, y + 4, ts - 12, 3);
    this.ctx.fillStyle = '#8a7aaa';
    [[x+5,y+5],[x+ts-8,y+5],[x+5,y+ts-8],[x+ts-8,y+ts-8]].forEach(([bx,by]) => {
      this.ctx.beginPath(); this.ctx.arc(bx, by, 2, 0, Math.PI*2); this.ctx.fill();
    });
  }

  private drawBrickTile(x: number, y: number): void {
    const ts = this.mapStore.tileSize();
    this.ctx.fillStyle = '#2d1428';
    this.ctx.fillRect(x, y, ts, ts);
    this.ctx.strokeStyle = '#ff2d7850';
    this.ctx.lineWidth   = 1.5;
    this.ctx.beginPath(); this.ctx.moveTo(x, y+ts*0.5); this.ctx.lineTo(x+ts, y+ts*0.5); this.ctx.stroke();
    this.ctx.beginPath(); this.ctx.moveTo(x+ts*0.5, y); this.ctx.lineTo(x+ts*0.5, y+ts*0.5); this.ctx.stroke();
    [ts*0.25, ts*0.75].forEach(ox => {
      this.ctx.beginPath(); this.ctx.moveTo(x+ox, y+ts*0.5); this.ctx.lineTo(x+ox, y+ts); this.ctx.stroke();
    });
    this.ctx.strokeStyle = '#ff2d7830';
    this.ctx.lineWidth   = 1;
    this.ctx.strokeRect(x, y, ts, ts);
  }

  private drawOtherPlayers(): void {
    for (const p of this.playersSnapshot) {
      if (p.id === this.playerId) continue;
      const palette = PLAYER_COLORS[p.spawnIndex % PLAYER_COLORS.length];
      this.drawTankAt(p.x, p.y, 'right', false, 0, palette, p.name);
    }
  }

  private drawTank(): void {
    if (this.playerIndex < 0) return;
    const palette = PLAYER_COLORS[this.playerIndex % PLAYER_COLORS.length];
    this.drawTankAt(
      this.tank.x, this.tank.y, this.tank.dir,
      this.tank.state === 'destroyed', this.tank.damageFrames,
      palette, null
    );
  }

  private drawTankAt(
    x: number, y: number, dir: string,
    destroyed: boolean, damageFrames: number,
    palette: typeof PLAYER_COLORS[0], label: string | null
  ): void {
    this.ctx.fillStyle = destroyed ? '#3a3040' : damageFrames > 0 ? '#ff2d78' : palette.body;
    this.ctx.fillRect(x, y, TANK_W, TANK_H);

    const cx = x + TANK_W / 2, cy = y + TANK_H / 2;
    this.ctx.beginPath();
    this.ctx.lineWidth   = 5;
    this.ctx.strokeStyle = destroyed ? '#555' : palette.cannon;
    const ends: Record<string, [number,number,number,number]> = {
      up:    [cx,cy,cx,cy-20], down: [cx,cy,cx,cy+20],
      left:  [cx,cy,cx-20,cy], right:[cx,cy,cx+20,cy],
    };
    const [x1,y1,x2,y2] = ends[dir] ?? ends['right'];
    this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.fillStyle = destroyed ? '#333' : palette.turret;
    this.ctx.arc(cx, cy, 7, 0, Math.PI*2);
    this.ctx.fill();

    if (label) {
      this.ctx.font      = '10px Share Tech Mono, monospace';
      this.ctx.fillStyle = palette.body;
      this.ctx.fillText(label, x, y - 5);
    }
  }

  private drawAllBullets(): void {
    this.ctx.fillStyle = '#fff1a8';
    for (const b of this.localBullets) {
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.fillStyle = '#ff6fa8';
    for (const b of this.remoteBullets) {
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawExplosions(): void {
    for (const ex of this.explosions) {
      this.ctx.beginPath();
      this.ctx.fillStyle = ex.t > 6 ? '#fff1a8' : '#ff2d78';
      this.ctx.arc(ex.x, ex.y, 4 + (10 - ex.t) * 1.5, 0, Math.PI*2);
      this.ctx.fill();
    }
  }

  private drawPowerUps(): void {
    const colors: Record<string,string> = { health:'#4fffb0', ammo:'#ffd166', speed:'#74b9ff' };
    for (const p of this.powerUpsOnScreen) {
      const c = colors[p.type] ?? '#c44bff';
      this.ctx.save();
      this.ctx.fillStyle = c; this.ctx.shadowColor = c; this.ctx.shadowBlur = 12;
      this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 10, 0, Math.PI*2); this.ctx.fill();
      this.ctx.restore();
      this.ctx.fillStyle = '#000';
      this.ctx.font = '9px Share Tech Mono, monospace';
      this.ctx.fillText(p.type, p.x - 14, p.y - 14);
    }
  }

  private drawCollisions(): void {
    for (const c of this.collisionsOnScreen) {
      const age = Date.now() - c.timestamp;
      this.ctx.globalAlpha = Math.max(0, 1 - age / 1000);
      this.ctx.strokeStyle = '#ff2d78'; this.ctx.lineWidth = 3;
      this.ctx.beginPath(); this.ctx.arc(c.x, c.y, 10 + (age/1000)*30, 0, Math.PI*2); this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    return !this.isBlockedByMap(x, y) && !this.isBlockedByTanks(x, y);
  }

  private isBlockedByMap(x: number, y: number): boolean {
    const grid = this.mapStore.grid();
    if (!this.mapStore.loaded() || !grid.length) return false;
    const ts = this.mapStore.tileSize();
    for (let r = Math.floor(y/ts); r <= Math.floor((y+TANK_H-1)/ts); r++)
      for (let c = Math.floor(x/ts); c <= Math.floor((x+TANK_W-1)/ts); c++) {
        if (r < 0 || c < 0 || r >= grid.length || c >= grid[r].length) continue;
        if (grid[r][c] === 1 || grid[r][c] === 2) return true;
      }
    return false;
  }

  private isBlockedByTanks(x: number, y: number): boolean {
    for (const p of this.playersSnapshot) {
      if (p.id === this.playerId) continue;
      if (x < p.x+TANK_W && x+TANK_W > p.x && y < p.y+TANK_H && y+TANK_H > p.y) return true;
    }
    return false;
  }

  private fireLocalBullet(): void {
    if (this.tank.state !== 'active') return;

    let vx = 0, vy = 0;
    if (this.tank.dir === 'up')    vy = -BULLET_SPEED;
    if (this.tank.dir === 'down')  vy =  BULLET_SPEED;
    if (this.tank.dir === 'left')  vx = -BULLET_SPEED;
    if (this.tank.dir === 'right') vx =  BULLET_SPEED;

    const bulletId = `${this.playerId}-${Date.now()}`;
    const x = this.tank.x + TANK_W / 2;
    const y = this.tank.y + TANK_H / 2;

    this.localBullets.push({ id: bulletId, shooterId: this.playerId, x, y, vx, vy, r: 3 });

    const roomId = this.currentRoomId();
    if (roomId) {
      const evt: BulletFiredEvent = { shooterId: this.playerId, bulletId, x, y, vx, vy };
      this.game.sendBulletFired(roomId, evt)
        .catch(err => console.error('[Canvas] sendBulletFired error:', err));
    }
  }

  private handleRemoteBullet(bullet: BulletFiredEvent): void {
    this.remoteBullets.push({
      id: bullet.bulletId, shooterId: bullet.shooterId,
      x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy, r: 3,
    });
  }

  private handleBulletHit(hit: BulletHitEvent): void {
    if (hit.targetPlayerId !== this.playerId) return;
    this.applyDamage(hit.damage);
  }

  private spawnExplosion(x: number, y: number, frames: number): void {
    this.explosions.push({ x, y, t: frames });
  }

  private applyDamage(amount: number): void {
    if (this.tank.state === 'destroyed') return;
    this.tank.hp = Math.max(0, this.tank.hp - amount);
    this.tank.damageFrames = 8;
    this.ui.damage(amount);
    if (this.tank.hp === 0) this.tank.state = 'destroyed';
  }

  sendChat(): void {
    const text = this.chatText.trim();
    if (!text) return;
    const msg: ChatMessage = {
      playerId: this.playerId, playerName: this.ui.name() || 'Player',
      message: text, timestamp: Date.now(),
    };
    const roomId = this.currentRoomId();
    if (roomId) this.game.sendChatMessage(roomId, msg)
      .catch(err => console.error('[Canvas] sendChatMessage error:', err));
    this.chatText = '';
  }

  triggerPowerUp(): void {
    const roomId = this.currentRoomId();
    if (!roomId || !this.game.connection) return;
    this.game.connection.invoke('TriggerPowerUp', roomId, 'health', Math.random()*600, Math.random()*400)
      .catch(err => console.error('[MQTT] TriggerPowerUp error:', err));
  }

  triggerCollision(): void {
    const roomId = this.currentRoomId();
    if (!roomId || !this.game.connection) return;
    this.game.connection.invoke('TriggerCollision', roomId, this.playerId, 'enemy-123', 300, 200, 25)
      .catch(err => console.error('[MQTT] TriggerCollision error:', err));
  }

  private handlePowerUp(powerUp: PowerUpEvent): void {
    this.store.dispatch(latencySampleAdded({ ms: Date.now() - powerUp.timestamp }));
    this.powerUpsOnScreen = [...this.powerUpsOnScreen,
      { x: powerUp.x, y: powerUp.y, type: powerUp.type, id: powerUp.id }];
    setTimeout(() => {
      this.powerUpsOnScreen = this.powerUpsOnScreen.filter(p => p.id !== powerUp.id);
      this.cdr.markForCheck();
    }, 5000);
  }

  private handleCollision(collision: CollisionEvent): void {
    this.store.dispatch(latencySampleAdded({ ms: Date.now() - collision.timestamp }));
    this.collisionsOnScreen = [...this.collisionsOnScreen,
      { x: collision.x, y: collision.y, timestamp: Date.now() }];
    if (collision.player1Id === this.playerId || collision.player2Id === this.playerId)
      this.applyDamage(collision.damage);
  }
}