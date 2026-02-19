// websocket.module.ts
import { Global, Module, OnModuleInit } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

@Global()
@Module({
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule implements OnModuleInit {
  constructor(private readonly websocketGateway: WebsocketGateway) {}

  onModuleInit() {
    console.log('🚀 Módulo WebSocket inicializado');
    // Pequeño delay para asegurar que el servidor está listo
    setTimeout(() => {
      const result = this.websocketGateway.emit('server.ready', { 
        message: 'Servidor WebSocket listo' 
      });
      console.log('📡 Prueba de emisión:', result ? 'exitosa' : 'falló');
    }, 2000);
  }
}