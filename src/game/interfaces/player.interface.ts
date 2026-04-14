export interface Player {
    id: string;           // socket id
    name: string;
    roomId: string;
    role: 'imposter' | 'player' | null;
    character: string | null;
    isHost: boolean;
  }