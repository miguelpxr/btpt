export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  lastSeen: number; //esta es el timestamp para los jugadores activos
  spawnIndex: number;
}