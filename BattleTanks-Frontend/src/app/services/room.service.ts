import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'

const API_URL = 'http://localhost:5111'

export type RoomState = 0 | 1 //sperar

export interface RoomResponse {
  id: string
  selectedMap: string
  state: number
  playerCount: number
}

@Injectable({ providedIn: 'root' })
export class RoomService {
  constructor(private http: HttpClient) {}

  getRooms(): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(`${API_URL}/api/room`)
  }

  createRoom(selectedMap: string): Observable<RoomResponse> {
    return this.http.post<RoomResponse>(`${API_URL}/api/room`, { selectedMap })
  }

  joinRoom(roomId: string): Observable<void> {
    return this.http.put<void>(`${API_URL}/api/room/${roomId}/join`, {})
  }
}
