import { Component, OnInit, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RoomService, RoomResponse } from '../services/room.service'
import { Router } from '@angular/router'
import { GameUiStore } from '../store/game-ui.store'

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './waiting-room.html',
  styleUrl: './waiting-room.scss',
})
export class WaitingRoom implements OnInit {

  selectedMap = 'desert'
  rooms: RoomResponse[] = []
  isLoadingRooms = false
  isCreating = false
  isJoining = false
  roomError = ''
  roomInfo = ''

  private roomService = inject(RoomService)
  private router = inject(Router)
  protected ui = inject(GameUiStore)

  ngOnInit(): void {
    this.loadRooms()
  }

  loadRooms(): void {
    this.roomError = ''
    this.roomInfo = ''
    this.isLoadingRooms = true

    this.roomService.getRooms().subscribe({
      next: (rooms) => {
        this.rooms = rooms
        this.isLoadingRooms = false
      },
      error: (err) => {
        this.isLoadingRooms = false
        this.roomError = this.mapHttpError(err, 'no pude cargar las salas')
      },
    })
  }

  createRoom(): void {
    this.roomError = ''
    this.roomInfo = ''
    const map = this.selectedMap.trim()
    if (!map) { this.roomError = 'debes indicar un mapa'; return }

    this.isCreating = true
    this.roomService.createRoom(map).subscribe({
      next: (room) => {
        this.isCreating = false
        this.roomInfo = `sala creada ${room.id}`
        this.loadRooms()
      },
      error: (err) => {
        this.isCreating = false
        this.roomError = this.mapHttpError(err, 'no pude crear la sala')
      },
    })
  }

  joinRoom(roomId: string): void {
    this.roomError = ''
    this.roomInfo = ''
    const id = this.ui.id()
    if (!id) { this.roomError = 'Error: no se detectó el id del jugador. Vuelve a loguearte.'; return }

    this.isJoining = true
    this.roomService.joinRoom(roomId).subscribe({
      next: () => {
        this.isJoining = false
        this.ui.setRoomId(roomId)
        this.loadRooms()
        this.router.navigate(['/game'])
      },
      error: (err) => {
        this.isJoining = false
        this.roomError = this.mapHttpError(err, 'no pude unirme a la sala')
      },
    })
  }

  private mapHttpError(err: any, fallback: string): string {
    if (typeof err?.error === 'string') return err.error
    if (err?.status === 401) return 'no autorizado, inicia sesión de nuevo'
    if (err?.status === 0) return 'no hay conexión con el backend'
    return fallback
  }
}