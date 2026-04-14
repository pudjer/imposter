import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { GameService } from './game.service';
  import { CreateRoomDto } from './dto/create-room.dto';
  import { JoinRoomDto } from './dto/join-room.dto';
import { Player } from './interfaces/player.interface';
import { Room } from './interfaces/room.interface';
  
  @WebSocketGateway({ cors: { origin: '*' } })
  export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    constructor(private readonly gameService: GameService) {}
  
    handleConnection(client: Socket) {
      console.log(`Client connected: ${client.id}`);
    }
  
    handleDisconnect(client: Socket) {
      console.log(`Client disconnected: ${client.id}`);
      const room = this.gameService.leaveRoom(client.id);
      if (room) {
        this.server.to(room.id).emit('playerLeft', {
          playerId: client.id,
          players: this.getPlayersList(room),
        });
      }
    }
  
    @SubscribeMessage('createRoom')
    handleCreateRoom(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: CreateRoomDto,
    ) {
      const room = this.gameService.createRoom(data.playerName, client.id);
      client.join(room.id);
      client.emit('roomCreated', {
        roomId: room.id,
        players: this.getPlayersList(room),
        isHost: true,
      });
    }
  
    @SubscribeMessage('joinRoom')
    handleJoinRoom(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: JoinRoomDto,
    ) {
      const room = this.gameService.joinRoom(data.roomId, data.playerName, client.id);
      if (!room) {
        client.emit('error', { message: 'Комната не найдена или игра уже началась' });
        return;
      }
  
      client.join(room.id);
      
      // Уведомляем нового игрока
      client.emit('joinedRoom', {
        roomId: room.id,
        players: this.getPlayersList(room),
        isHost: room.hostId === client.id,
      });
  
      // Уведомляем остальных о новом игроке
      client.to(room.id).emit('playerJoined', {
        player: {
          id: client.id,
          name: data.playerName,
          isHost: false,
        },
        players: this.getPlayersList(room),
      });
    }
  
    @SubscribeMessage('startGame')
    handleStartGame(@ConnectedSocket() client: Socket) {
      const room = this.gameService.getPlayerRoom(client.id);
      if (!room) return;
  
      const updatedRoom = this.gameService.startGame(room.id, client.id);
      if (!updatedRoom) {
        client.emit('error', { message: 'Нельзя начать игру' });
        return;
      }
  
      // Отправляем каждому игроку его личную карточку
      for (const [socketId, player] of updatedRoom.players) {
        this.server.to(socketId).emit('gameStarted', {
          role: player.role,
          character: player.character,
        });
      }
  
      // Общее уведомление о начале игры
      this.server.to(room.id).emit('gameStatus', { started: true });
    }
  
    @SubscribeMessage('leaveRoom')
    handleLeaveRoom(@ConnectedSocket() client: Socket) {
      const room = this.gameService.leaveRoom(client.id);
      if (room) {
        client.leave(room.id);
        this.server.to(room.id).emit('playerLeft', {
          playerId: client.id,
          players: this.getPlayersList(room),
        });
      }
      client.emit('leftRoom');
    }
    @SubscribeMessage('resetGame')
    handleResetGame(@ConnectedSocket() client: Socket) {
      const room = this.gameService.getPlayerRoom(client.id);
      if (!room) return;

      const updatedRoom = this.gameService.resetGame(room.id, client.id);
      if (!updatedRoom) {
        client.emit('error', { message: 'Не удалось сбросить игру' });
        return;
      }

      this.server.to(room.id).emit('gameReset', {
        players: this.getPlayersList(updatedRoom)
      });
    }
    private getPlayersList(room: Room) {
      return Array.from(room.players.values()).map((p: Player) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
      }));
    }
  }