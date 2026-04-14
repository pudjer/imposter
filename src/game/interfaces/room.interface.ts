import { Player } from './player.interface';

export interface Room {
  id: string;
  hostId: string;
  players: Map<string, Player>;   // key = socket id
  gameStarted: boolean;
  imposterId: string | null;
}