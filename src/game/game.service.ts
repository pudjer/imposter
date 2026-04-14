import { Injectable } from '@nestjs/common';
import { Room } from './interfaces/room.interface';
import { Player } from './interfaces/player.interface';
import { POPULAR_CHARACTERS } from '../data/characters';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();

  createRoom(playerName: string, socketId: string): Room {
    const roomId = this.generateRoomId();
    const player: Player = {
      id: socketId,
      name: playerName,
      roomId,
      role: null,
      character: null,
      isHost: true,
    };

    const room: Room = {
      id: roomId,
      hostId: socketId,
      players: new Map([[socketId, player]]),
      gameStarted: false,
      imposterId: null,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, playerName: string, socketId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.gameStarted) return null;

    const player: Player = {
      id: socketId,
      name: playerName,
      roomId,
      role: null,
      character: null,
      isHost: false,
    };

    room.players.set(socketId, player);
    return room;
  }

  leaveRoom(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) {
        room.players.delete(socketId);

        // Если комната пуста - удаляем
        if (room.players.size === 0) {
          this.rooms.delete(room.id);
          return null;
        }

        // Если вышел хост, назначаем нового хоста
        if (room.hostId === socketId) {
          const newHost = room.players.values().next().value;
          if (newHost) {
            room.hostId = newHost.id;
            newHost.isHost = true;
          }
        }

        return room;
      }
    }
    return null;
  }
  resetGame(roomId: string, socketId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.hostId !== socketId || !room.gameStarted) {
      return null;
    }
  
    room.gameStarted = false;
    room.imposterId = null;
  
    for (const player of room.players.values()) {
      player.role = null;
      player.character = null;
    }
  
    return room;
  }
  startGame(roomId: string, socketId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.hostId !== socketId || room.gameStarted || room.players.size < 2) {
      return null;
    }

    room.gameStarted = true;
    const playerIds = Array.from(room.players.keys());
    
    // Выбираем импостера случайно
    const imposterIndex = Math.floor(Math.random() * playerIds.length);
    const imposterId = playerIds[imposterIndex];
    room.imposterId = imposterId;

    // Готовим список доступных персонажей (исключаем уже выданные)
    const availableCharacters = [...POPULAR_CHARACTERS];
    this.shuffleArray(availableCharacters);

    // Раздаём роли и персонажей
    for (const [id, player] of room.players) {
      if (id === imposterId) {
        player.role = 'imposter';
        player.character = 'Импостер';
      } else {
        player.role = 'player';
        player.character = availableCharacters.pop() || 'Безликий';
      }
    }

    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getPlayerRoom(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return undefined;
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}