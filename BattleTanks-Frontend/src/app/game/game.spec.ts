import { ComponentFixture, TestBed } from '@angular/core/testing'
import { GameComponent } from './game'

describe('Game', () => {
  let component: GameComponent
  let fixture: ComponentFixture<GameComponent>

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameComponent],
    })
      .overrideComponent(GameComponent, {
        set: { template: `<p>game</p>` },
      })
      .compileComponents()

    fixture = TestBed.createComponent(GameComponent)
    component = fixture.componentInstance
    fixture.detectChanges()
  })

  it('should create', () => {
    expect(component).toBeTruthy()
  })
})
