import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * Socket.IO gateway broadcasting real-time booking confirmations
 * and availability updates to all connected clients.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitBookingCreated(booking: unknown) {
    this.server?.emit('booking.created', booking);
  }

  emitBookingUpdated(booking: unknown) {
    this.server?.emit('booking.updated', booking);
  }

  emitBookingDeleted(id: string) {
    this.server?.emit('booking.deleted', { id });
  }

  emitAvailabilityChanged(hotelId: string) {
    this.server?.emit('availability.changed', { hotelId });
  }
}
