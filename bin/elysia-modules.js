#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

// ─── ANSI colours (no deps) ────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  dim:    '\x1b[2m',
};

const ok   = (msg) => console.log(`${C.green}✔${C.reset}  ${msg}`);
const info = (msg) => console.log(`${C.cyan}ℹ${C.reset}  ${msg}`);
const warn = (msg) => console.log(`${C.yellow}⚠${C.reset}  ${msg}`);
const err  = (msg) => console.error(`${C.red}✖${C.reset}  ${msg}`);

// ─── Templates ────────────────────────────────────────────────────────────

function toPascal(str) {
  return str.split(/[-_\s]+/).map(s => s[0].toUpperCase() + s.slice(1)).join('');
}

const templates = {
  module: (name) => {
    const P = toPascal(name);
    return `import { Module } from 'elysia-modules';
import { ${P}Controller } from './${name}.controller';
import { ${P}Service } from './${name}.service';

@Module({
  controllers: [${P}Controller],
  providers:   [${P}Service],
  exports:     [${P}Service],
})
export class ${P}Module {}
`;
  },

  controller: (name) => {
    const P = toPascal(name);
    return `import { Controller, Get, Post, Put, Delete, Body, Params, Res } from 'elysia-modules';
import { ${P}Service } from './${name}.service';

@Controller('/${name}s')
export class ${P}Controller {
  constructor(private readonly ${name}Service: ${P}Service) {}

  @Get('/')
  findAll() {
    return this.${name}Service.findAll();
  }

  @Get('/:id')
  findOne(@Params('id') id: string, @Res() set: any) {
    const item = this.${name}Service.findOne(Number(id));
    if (!item) { set.status = 404; return { error: 'Not found' }; }
    return item;
  }

  @Post('/')
  create(@Body() body: any, @Res() set: any) {
    set.status = 201;
    return this.${name}Service.create(body);
  }

  @Put('/:id')
  update(@Params('id') id: string, @Body() body: any) {
    return this.${name}Service.update(Number(id), body);
  }

  @Delete('/:id')
  remove(@Params('id') id: string, @Res() set: any) {
    this.${name}Service.remove(Number(id));
    set.status = 204;
  }
}
`;
  },

  service: (name) => {
    const P = toPascal(name);
    return `import { Injectable } from 'elysia-modules';

@Injectable()
export class ${P}Service {
  private items: any[] = [];

  findAll()              { return this.items; }
  findOne(id: number)    { return this.items.find(i => i.id === id); }

  create(data: any) {
    const item = { id: Date.now(), ...data };
    this.items.push(item);
    return item;
  }

  update(id: number, data: any) {
    const item = this.findOne(id);
    if (!item) return null;
    Object.assign(item, data);
    return item;
  }

  remove(id: number) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx !== -1) this.items.splice(idx, 1);
  }
}
`;
  },

  middleware: (name) => {
    const P = toPascal(name);
    return `import { Injectable } from 'elysia-modules';
import type { ElysiaMiddleware, MiddlewareNext } from 'elysia-modules';

@Injectable()
export class ${P}Middleware implements ElysiaMiddleware {
  async use(ctx: Record<string, any>, next: MiddlewareNext): Promise<void> {
    // TODO: add middleware logic
    await next();
  }
}
`;
  },

  filter: (name) => {
    const P = toPascal(name);
    return `import { Catch } from 'elysia-modules';
import type { ExceptionFilter } from 'elysia-modules';

@Catch()
export class ${P}Filter implements ExceptionFilter {
  catch(exception: unknown, ctx: Record<string, any>) {
    console.error('[${P}Filter]', exception);
    ctx.set.status = 500;
    return {
      statusCode: 500,
      error: 'Internal Server Error',
      message: exception instanceof Error ? exception.message : 'Unexpected error',
    };
  }
}
`;
  },
};

// ─── File writer ──────────────────────────────────────────────────────────

function writeFile(filePath, content, overwrite = false) {
  if (fs.existsSync(filePath) && !overwrite) {
    warn(`Skipped (already exists): ${path.relative(process.cwd(), filePath)}`);
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  ok(`Created: ${C.dim}${path.relative(process.cwd(), filePath)}${C.reset}`);
  return true;
}

// ─── Commands ─────────────────────────────────────────────────────────────

const commands = {
  // generate:module <name> [dir]
  'generate:module': (args) => {
    const [name, dir = `src/${name}`] = args;
    if (!name) { err('Usage: elysia-modules generate:module <name> [dir]'); process.exit(1); }
    writeFile(path.join(process.cwd(), dir, `${name}.module.ts`),     templates.module(name));
    writeFile(path.join(process.cwd(), dir, `${name}.controller.ts`), templates.controller(name));
    writeFile(path.join(process.cwd(), dir, `${name}.service.ts`),    templates.service(name));
    info(`Module ${C.bold}${toPascal(name)}Module${C.reset} scaffolded in ${dir}/`);
  },

  // generate:controller <name> [dir]
  'generate:controller': (args) => {
    const [name, dir = `src/${name}`] = args;
    if (!name) { err('Usage: elysia-modules generate:controller <name> [dir]'); process.exit(1); }
    writeFile(path.join(process.cwd(), dir, `${name}.controller.ts`), templates.controller(name));
  },

  // generate:service <name> [dir]
  'generate:service': (args) => {
    const [name, dir = `src/${name}`] = args;
    if (!name) { err('Usage: elysia-modules generate:service <name> [dir]'); process.exit(1); }
    writeFile(path.join(process.cwd(), dir, `${name}.service.ts`), templates.service(name));
  },

  // generate:middleware <name> [dir]
  'generate:middleware': (args) => {
    const [name, dir = `src/common/middlewares`] = args;
    if (!name) { err('Usage: elysia-modules generate:middleware <name> [dir]'); process.exit(1); }
    writeFile(path.join(process.cwd(), dir, `${name}.middleware.ts`), templates.middleware(name));
  },

  // generate:filter <name> [dir]
  'generate:filter': (args) => {
    const [name, dir = `src/common/filters`] = args;
    if (!name) { err('Usage: elysia-modules generate:filter <name> [dir]'); process.exit(1); }
    writeFile(path.join(process.cwd(), dir, `${name}.filter.ts`), templates.filter(name));
  },

  // Aliases: g:m, g:c, g:s, g:mw, g:f
  'g:m':  (args) => commands['generate:module'](args),
  'g:c':  (args) => commands['generate:controller'](args),
  'g:s':  (args) => commands['generate:service'](args),
  'g:mw': (args) => commands['generate:middleware'](args),
  'g:f':  (args) => commands['generate:filter'](args),
};

// ─── Help ─────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${C.bold}${C.cyan}elysia-modules${C.reset} — NestJS-like scaffolding for Elysia.js

${C.bold}Usage:${C.reset}
  elysia-modules <command> [arguments]

${C.bold}Commands:${C.reset}
  ${C.green}generate:module${C.reset}     <name> [dir]   Scaffold module + controller + service
  ${C.green}generate:controller${C.reset} <name> [dir]   Scaffold a controller
  ${C.green}generate:service${C.reset}    <name> [dir]   Scaffold a service
  ${C.green}generate:middleware${C.reset} <name> [dir]   Scaffold a middleware class
  ${C.green}generate:filter${C.reset}     <name> [dir]   Scaffold an exception filter

${C.bold}Aliases:${C.reset}
  g:m  →  generate:module
  g:c  →  generate:controller
  g:s  →  generate:service
  g:mw →  generate:middleware
  g:f  →  generate:filter

${C.bold}Examples:${C.reset}
  elysia-modules generate:module user
  elysia-modules g:m post src/features/post
  elysia-modules g:mw auth src/common/middlewares
  elysia-modules g:f global src/common/filters
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

const [,, cmd, ...rest] = process.argv;

if (!cmd || cmd === '--help' || cmd === '-h') {
  printHelp();
  process.exit(0);
}

const handler = commands[cmd];
if (!handler) {
  err(`Unknown command: ${cmd}`);
  printHelp();
  process.exit(1);
}

try {
  handler(rest);
} catch (e) {
  err(e.message);
  process.exit(1);
}
