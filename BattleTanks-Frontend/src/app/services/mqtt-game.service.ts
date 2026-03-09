import { Injectable, inject } from '@angular/core';
import { IMqttMessage, MqttService } from 'ngx-mqtt';
import { Subject } from 'rxjs';

export interface PowerUpEvent {
  type: string;
  x: number;
  y: number;
  id: string;
  timestamp: number;
}

export interface CollisionEvent {
  player1Id: string;
  player2Id: string;
  x: number;
  y: number;
  damage: number;
  timestamp: number;
}

export interface GameEndEvent {
  winnerId: string;
  winnerName: string;
  finalScore: number;
  results: any[];
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class MqttGameService {
  private mqtt = inject(MqttService);

  private powerUpSubject = new Subject<PowerUpEvent>();
  private collisionSubject = new Subject<CollisionEvent>();
  private gameEndSubject = new Subject<GameEndEvent>();

  powerUp$ = this.powerUpSubject.asObservable();
  collision$ = this.collisionSubject.asObservable();
  gameEnd$ = this.gameEndSubject.asObservable();

  subscribeToPowerUps(roomId: string): void {
    const topic = `game/${roomId}/powerup`;
    console.log(`Suscribiéndose a: ${topic}`);

    this.mqtt.observe(topic, { qos: 1 }).subscribe({
      next: (message: IMqttMessage) => {
        const payload = message.payload.toString();
        const powerUp: PowerUpEvent = JSON.parse(payload);
        
        const latency = Date.now() - powerUp.timestamp;
        console.log(`[MQTT] PowerUp recibido - Type: ${powerUp.type}, Latency: ${latency}ms`);
        
        this.powerUpSubject.next(powerUp);
      },
      error: (err) => console.error('Error en power-up:', err)
    });
  }

  subscribeToCollisions(roomId: string): void {
    const topic = `game/${roomId}/collision`;
    console.log(`Suscribiéndose a: ${topic}`);

    this.mqtt.observe(topic, { qos: 2 }).subscribe({
      next: (message: IMqttMessage) => {
        const payload = message.payload.toString();
        const collision: CollisionEvent = JSON.parse(payload);
        
        const latency = Date.now() - collision.timestamp;
        console.log(`[MQTT] Colisión recibida - Latency: ${latency}ms`);
        
        this.collisionSubject.next(collision);
      },
      error: (err) => console.error('Error en colisión:', err)
    });
  }

  subscribeToGameEnd(roomId: string): void {
    const topic = `game/${roomId}/gameend`;
    console.log(`Suscribiéndose a: ${topic}`);

    this.mqtt.observe(topic, { qos: 1 }).subscribe({
      next: (message: IMqttMessage) => {
        const payload = message.payload.toString();
        const gameEnd: GameEndEvent = JSON.parse(payload);
        
        console.log(`[MQTT] Fin de juego - Winner: ${gameEnd.winnerName}`);
        
        this.gameEndSubject.next(gameEnd);
      },
      error: (err) => console.error('Error en game-end:', err)
    });
  }

  subscribeToRoom(roomId: string): void {
    this.subscribeToPowerUps(roomId);
    this.subscribeToCollisions(roomId);
    this.subscribeToGameEnd(roomId);
  }

  unsubscribeFromRoom(roomId: string): void {
    console.log(`Desuscrito de sala: ${roomId}`);
  }
}