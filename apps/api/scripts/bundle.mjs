// Zabalí zkompilované API (dist/) do jednoho souboru, který web na Vercelu spouští v /api/*.
// Nativní balíčky (Prisma, sharp) zůstávají externí – instaluje je i web.
import { build } from 'esbuild';

await build({
  entryPoints: ['dist/main.js'],
  outfile: '../web/.api/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  logLevel: 'warning',
  keepNames: true,
  external: [
    '@prisma/client', '.prisma/client', 'sharp',
    // volitelné moduly NestJS, které nepoužíváme
    '@nestjs/microservices', '@nestjs/microservices/*', '@nestjs/websockets', '@nestjs/websockets/*',
    'class-transformer', 'class-transformer/*', 'class-validator', '@fastify/*',
  ],
});
console.log('API zabaleno do apps/web/.api/server.js');
