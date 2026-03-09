import { Component, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { AuthService } from '../../services/auth.service'
import { Router } from '@angular/router'
import { GameUiStore } from '../../store/game-ui.store'
import { GameService } from '../../services/game.service'

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  email = ''
  password = ''
  error = ''
  success = false
  activeChar = 0

  private auth = inject(AuthService)
  private router = inject(Router)
  private ui = inject(GameUiStore)
  private game = inject(GameService)

  login() {
    this.error = ''
    this.success = false
  
    console.log('[auth] intentando login', {
      email: this.email,
    })
  
    this.auth.login({
      email: this.email,
      password: this.password,
    }).subscribe({
      next: async (res) => {
        console.log('[auth] login ok', {
          playerId: res.playerId,
          email: res.email,
          name: res.name
        })
        
        this.ui.setName(res.name)
        this.ui.setId(res.playerId)
  
        console.log('[auth] token guardado', !!localStorage.getItem('bt_token'))
  
        try {
          await this.game.connect();
          console.log('[auth] SignalR conectado con token correcto');
        } catch (err) {
          console.error('[auth] Error conectando SignalR:', err);
        }
  
        this.success = true
  
        console.log('[auth] navegando a /waiting-room')
        this.router.navigate(['/waiting-room']).then(ok => {
          console.log('[auth] navigate result', ok)
        })
      },
      error: (err) => {
        console.log('[auth] login error', err)
        this.error = err.error || 'error al iniciar sesión'
      }
    })
  }
}