import { Injectable, inject, Injector } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { BehaviorSubject, Observable, tap } from 'rxjs'
import { GameService } from './game.service'

const API_URL = 'http://localhost:5111'
const TOKEN_KEY = 'bt_token'

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  playerId: string
  name: string
  email: string
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenSubject = new BehaviorSubject<string | null>(this.getToken())
  private injector = inject(Injector)

  token$ = this.tokenSubject.asObservable()

  constructor(private http: HttpClient) {}

  register(req: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_URL}/api/auth/register`, req)
      .pipe(tap(res => this.setToken(res.token)))
  }

  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${API_URL}/api/auth/login`, req)
      .pipe(tap(res => this.setToken(res.token)))
  }

  async logout(): Promise<void> {
    const game = this.injector.get(GameService)
    await game.disconnect()
    
    localStorage.removeItem(TOKEN_KEY)
    this.tokenSubject.next(null)
    
    console.log('[AuthService] Logout completo')
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }

  isLoggedIn(): boolean {
    return !!this.getToken()
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
    this.tokenSubject.next(token)
  }
}