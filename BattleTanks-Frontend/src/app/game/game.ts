import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameCanvasComponent } from '../game-canvas/game-canvas';
import { GameUiStore } from '../store/game-ui.store';
import { GameService } from '../services/game.service';
import { Router } from '@angular/router';
import { EventHistoryService } from '../services/event-history.service';
import { MqttGameService } from '../services/mqtt-game.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule, GameCanvasComponent],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class GameComponent implements OnInit, OnDestroy {

  private ui = inject(GameUiStore);
  private game = inject(GameService);
  private router = inject(Router);
  private eventHistory = inject(EventHistoryService);
  private mqttGame = inject(MqttGameService);

  eventStats: any = null;

  name = this.ui.name;
  hp = this.ui.hp;
  ammo = this.ui.ammo;
  score = this.ui.score;

  async ngOnInit(): Promise<void> {
    const roomId = this.ui.roomId();
    
    if (!roomId) {
      console.error('[GameComponent] No hay roomId, redirigiendo a waiting-room');
      this.router.navigate(['/waiting-room']);
      return;
    }

    try {
      await this.game.joinRoomGroup(roomId);
      console.log('[GameComponent] Unido al grupo SignalR:', roomId);

      this.mqttGame.subscribeToRoom(roomId);
      console.log('[GameComponent] Suscrito a MQTT room:', roomId);

      await this.loadRoomHistory(roomId);
      this.loadRoomStats(roomId);

    } catch (err) {
      console.error('[GameComponent] Error al inicializar:', err);
    }
  }


  private async loadRoomHistory(roomId: string): Promise<void> {
    try {
      const history = await firstValueFrom(
        this.eventHistory.getRoomHistory(roomId)
      );

      if (history) {
        console.log('Historial cargado:', {
          powerUps: history.powerUps?.length ?? 0,
          collisions: history.collisions?.length ?? 0,
          chat: history.chatMessages?.length ?? 0
        });
      }

    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  }

  private loadRoomStats(roomId: string): void {
    this.eventHistory.getRoomStats(roomId).subscribe({
      next: (stats) => {
        this.eventStats = stats;
        console.log('Estadísticas cargadas:', stats);
      },
      error: (err) => console.error('Error cargando stats:', err)
    });
  }

  ngOnDestroy(): void {
    const roomId = this.ui.roomId();
    
    if (roomId) {
      this.game.leaveRoomGroup(roomId);
      this.mqttGame.unsubscribeFromRoom(roomId);
      this.ui.setRoomId('');
    }
  }
}