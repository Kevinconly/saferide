import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_TOKEN_SECRET = 'test-refresh-secret';

import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/common/redis.service';
import { RealtimeService } from '../../src/modules/websocket/realtime.service';
import { RidesService } from '../../src/modules/rides/rides.service';
import { DispatchService } from '../../src/modules/rides/dispatch.service';
import { OutboxService } from '../../src/modules/outbox/outbox.service';
import { NotificationService } from '../../src/modules/notifications/notification.service';
import { SocketGateway } from '../../src/modules/websocket/socket.gateway';

describe('AppModule DI graph', () => {
  it('resolves every provider without a database', async () => {
    const prismaMock = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      driver: { findFirst: jest.fn(), findUnique: jest.fn() },
      ride: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      rideEvent: { create: jest.fn() },
      payment: { create: jest.fn() },
      outbox: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      notificationSubscription: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((fn: (tx: any) => Promise<unknown>) => fn({})),
    };

    const redisMock = {
      getClient: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(null),
        del: jest.fn().mockResolvedValue(1),
        ping: jest.fn().mockResolvedValue('PONG'),
      }),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    expect(moduleRef.get(RidesService)).toBeDefined();
    expect(moduleRef.get(DispatchService)).toBeDefined();
    expect(moduleRef.get(OutboxService)).toBeDefined();
    expect(moduleRef.get(NotificationService)).toBeDefined();
    expect(moduleRef.get(RealtimeService)).toBeDefined();
    expect(moduleRef.get(SocketGateway)).toBeDefined();

    await app.close();
  });
});
