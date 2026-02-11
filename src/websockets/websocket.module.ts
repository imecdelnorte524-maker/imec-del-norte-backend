import { Global, Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

@Global()
@Module({
  providers: [WebsocketGateway],
  exports: [WebsocketGateway], // importante para poder inyectarlo en otros módulos
})
export class WebsocketModule {}