import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, normalizePhone } from './auth.service';

@Injectable()
export class AuthSeedService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      if (!this.hasPrismaModels()) {
        return;
      }

      await this.seedDefaultUser({
        phone: '0785222261',
        email: 'admin@saferide.com',
        username: 'admin',
        name: 'admin',
        role: 'ADMIN',
        password: 'admin',
        isVerified: true,
      });

      await this.seedDefaultUser({
        phone: '0785222262',
        email: 'customer@saferide.com',
        username: 'customer',
        name: 'customer',
        role: 'PASSENGER',
        password: 'customer',
        isVerified: true,
      });

      await this.seedDefaultUser({
        phone: '0785222263',
        email: 'rider@saferide.com',
        username: 'rider',
        name: 'rider',
        role: 'DRIVER',
        password: 'rider',
        isVerified: true,
      });
    } catch (err) {
      // Don't crash the app if the database isn't available during local development.
      // Log and continue so the HTTP server can start for frontend development.
      // eslint-disable-next-line no-console
      console.warn(
        '[AuthSeedService] skipping seeding due to error:',
        err?.message ?? err,
      );
    }
  }

  private hasPrismaModels(): boolean {
    return (
      !!this.prisma.user &&
      typeof this.prisma.user.findUnique === 'function' &&
      typeof this.prisma.user.create === 'function' &&
      typeof this.prisma.driver?.create === 'function'
    );
  }

  private async seedDefaultUser(input: {
    phone: string;
    email: string;
    username?: string;
    name: string;
    role: 'ADMIN' | 'PASSENGER' | 'DRIVER';
    password: string;
    isVerified: boolean;
  }) {
    const phone = normalizePhone(input.phone);
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      const updates: { username?: string | null; email?: string | null } = {};
      if (input.username && existing.username !== input.username) {
        updates.username = input.username.toLowerCase();
      }
      if (
        input.email &&
        existing.email?.toLowerCase() !== input.email.toLowerCase()
      ) {
        updates.email = input.email.toLowerCase();
      }
      if (Object.keys(updates).length) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: updates,
        });
      }
      return;
    }

    const user = await this.prisma.user.create({
      data: {
        phone,
        username: input.username ?? null,
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        passwordHash: hashPassword(input.password),
        status: 'ACTIVE',
        isVerified: input.isVerified,
        tokenVersion: 0,
      },
    });

    if (input.role === 'DRIVER') {
      await this.prisma.driver.create({
        data: {
          userId: user.id,
          vehicleMake: 'SafeRide',
          vehicleModel: 'Default',
          plateNumber: 'SR-0001',
          rating: 5.0,
          status: 'ACTIVE',
          isVerified: true,
        },
      });
    }
  }
}
