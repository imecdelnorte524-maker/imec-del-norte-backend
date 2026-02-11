import {
  // OnGatewayConnection,
  // OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const allowedOrigins = [
  'https://imec-del-norte-web.onrender.com',
  'https://imec-del-norte-sandbox.onrender.com',
  'https://imec-del-norte-backend.onrender.com',
  'https://m3h6rtnz-3032.use.devtunnels.ms',
  'http://localhost:5173',
  'http://localhost:3000',
];

@WebSocketGateway({
  cors: {
    origin: allowedOrigins,
  },
})
export class WebsocketGateway
  // implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // handleConnection(client: Socket) {
  //   console.log(`Client connected: ${client.id}`);
  // }

  // handleDisconnect(client: Socket) {
  //   console.log(`Client disconnected: ${client.id}`);
  // }

  // Método genérico para emitir eventos
  emit(event: string, data: any) {
    this.server.emit(event, data);
  }
}
