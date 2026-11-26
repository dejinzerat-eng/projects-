import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Otisk fotky (BIGINT) se do odpovědí API nedostane – JSON BigInt neumí a klient ho nepotřebuje.
    // Kde je potřeba (hledání duplicit), vybírá se výslovně přes `select`.
    super({ omit: { listingImage: { phash: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
