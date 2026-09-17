import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { CompanyMember } from '../company-members/entities/company-member.entity';
import { MembershipStatus } from '../common/enums';
import { AuthJwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RealtimeEvent, companyRoom } from './realtime.constants';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
  };
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<AuthJwtPayload>(token, {
        secret: this.configService.getOrThrow<string>('app.jwt.accessSecret'),
      });

      if (payload.type !== 'access') {
        client.disconnect(true);
        return;
      }

      client.data = { userId: payload.sub };
      await client.join(`user:${payload.sub}`);
      this.logger.debug(`Client connected: ${client.id} user=${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinCompany')
  async handleJoinCompany(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { companyId?: string },
  ): Promise<{ joined: boolean; room?: string; error?: string }> {
    const companyId = body?.companyId;
    if (!companyId || !client.data?.userId) {
      return { joined: false, error: 'Invalid request' };
    }

    const membership = await this.companyMemberRepository.findOne({
      where: {
        userId: client.data.userId,
        companyId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      return { joined: false, error: 'Company membership required' };
    }

    const room = companyRoom(companyId);
    await client.join(room);
    return { joined: true, room };
  }

  @SubscribeMessage('joinTrip')
  async handleJoinTrip(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { tripId?: string; companyId?: string },
  ): Promise<{ joined: boolean; error?: string }> {
    if (!body?.tripId || !body?.companyId || !client.data?.userId) {
      return { joined: false, error: 'Invalid request' };
    }

    const membership = await this.companyMemberRepository.findOne({
      where: {
        userId: client.data.userId,
        companyId: body.companyId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      return { joined: false, error: 'Company membership required' };
    }

    await client.join(`trip:${body.tripId}`);
    return { joined: true };
  }

  @SubscribeMessage('joinRider')
  async handleJoinRider(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { riderId?: string; companyId?: string },
  ): Promise<{ joined: boolean; error?: string }> {
    if (!body?.riderId || !body?.companyId || !client.data?.userId) {
      return { joined: false, error: 'Invalid request' };
    }

    const membership = await this.companyMemberRepository.findOne({
      where: {
        userId: client.data.userId,
        companyId: body.companyId,
        status: MembershipStatus.ACTIVE,
      },
    });

    if (!membership) {
      return { joined: false, error: 'Company membership required' };
    }

    await client.join(`rider:${body.riderId}`);
    return { joined: true };
  }

  emitToCompany(companyId: string, event: RealtimeEvent, payload: unknown): void {
    this.emitToRoom(companyRoom(companyId), event, payload);
  }

  emitToRoom(room: string, event: RealtimeEvent, payload: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(room).emit(event, payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    return null;
  }
}
