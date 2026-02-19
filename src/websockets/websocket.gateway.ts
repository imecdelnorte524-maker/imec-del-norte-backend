// websocket.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// const allowedOrigins = [
//   'https://imec-del-norte-web.onrender.com',
//   'https://imec-del-norte-sandbox.onrender.com',
//   'https://imec-del-norte-backend.onrender.com',
//   'https://m3h6rtnz-3032.use.devtunnels.ms',
//   'http://localhost:5173',
//   'http://localhost:3000',
// ];

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // Almacenar sockets activos
  private connectedClients: Map<string, Socket> = new Map();

  handleConnection(client: Socket) {
    // console.log(`✅ Cliente conectado: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    // console.log(`❌ Cliente desconectado: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  // Emitir a TODOS los clientes
  emitToAll(event: string, data: any): boolean {
    try {
      this.server.emit(event, data);
      return true;
    } catch (error) {
      console.error(`Error emitiendo a todos:`, error);
      return false;
    }
  }

  // Emitir a un cliente específico por su ID
  emitToClient(clientId: string, event: string, data: any): boolean {
    try {
      const client = this.connectedClients.get(clientId);
      if (client) {
        client.emit(event, data);
        return true;
      }
      console.log(`Cliente ${clientId} no encontrado`);
      return false;
    } catch (error) {
      console.error(`Error emitiendo a cliente ${clientId}:`, error);
      return false;
    }
  }

  // Mantener compatibilidad con código existente
  emit(event: string, data: any): boolean {
    return this.emitToAll(event, data);
  }
}
