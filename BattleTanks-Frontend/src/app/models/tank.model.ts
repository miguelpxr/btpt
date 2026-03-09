export type TankDirection = 'up' | 'down' | 'left' | 'right';
export type TankState = 'active' | 'destroyed';

export interface Tank {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: TankDirection;
  hp: number;
  state: TankState;
  speed: number;
  damageFrames: number;
}
