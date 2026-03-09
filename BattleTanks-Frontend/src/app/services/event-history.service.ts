import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RoomEventHistory {
  roomId: string;
  powerUps: PowerUpEvent[];
  collisions: CollisionEvent[];
  chatMessages: ChatMessage[];
  retrievedAt: string;
}

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

export interface ChatMessage {
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

export interface RoomEventStats {
  roomId: string;
  powerUpsCount: number;
  collisionsCount: number;
  chatMessagesCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class EventHistoryService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5111/api/eventhistory';

  getRoomHistory(roomId: string): Observable<RoomEventHistory> {
    return this.http.get<RoomEventHistory>(`${this.baseUrl}/${roomId}`);
  }

  getPowerUpHistory(roomId: string, count: number = 50): Observable<PowerUpEvent[]> {
    return this.http.get<PowerUpEvent[]>(`${this.baseUrl}/${roomId}/powerups?count=${count}`);
  }

  getCollisionHistory(roomId: string, count: number = 50): Observable<CollisionEvent[]> {
    return this.http.get<CollisionEvent[]>(`${this.baseUrl}/${roomId}/collisions?count=${count}`);
  }

  getChatHistory(roomId: string, count: number = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/${roomId}/chat?count=${count}`);
  }

  getRoomStats(roomId: string): Observable<RoomEventStats> {
    return this.http.get<RoomEventStats>(`${this.baseUrl}/${roomId}/stats`);
  }
}