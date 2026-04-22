# elysia-modules

> NestJS-like modular architecture for [Elysia.js](https://elysiajs.com/) — **modules**, **providers**, **controllers**, **dependency injection**, **lifecycle hooks**, **middleware**, **Zod validation**, and **exception filters**.

```
Elysia performance  +  NestJS structure  =  🔥 elysia-modules
```

---

## Features

| Feature | Details |
|---|---|
| 🏗️ **Module system** | Organise app into reusable feature modules with `imports` / `exports` |
| 💉 **Dependency Injection** | Constructor injection, `useClass` / `useValue` / `useFactory`, `@Inject(TOKEN)` |
| 🎮 **Controllers** | Class-based route handlers with prefix support |
| ♻️ **Lifecycle hooks** | `onModuleInit`, `onApplicationBootstrap`, `onModuleDestroy`, `onApplicationShutdown` |
| 🔗 **Middleware** | Class-based `@UseMiddleware()` — controller-wide or per-route |
| ✅ **Validation** | `@ValidateBody / @ValidateQuery / @ValidateParams` with Zod — auto 422 responses |
| 🛡️ **Exception filters** | `@Catch()`, `@UseFilter()`, built-in `HttpException` hierarchy, global filters |
| ⚡ **CLI** | `elysia-modules generate:module user` scaffolds full module in seconds |
| 📦 **Dual ESM + CJS** | Works with Bun, Node, edge runtimes |

---

## Installation

```bash
bun add elysia-modules elysia reflect-metadata
bun add zod   # optional — only needed for @ValidateBody / @ValidateQuery / @ValidateParams
```

> **tsconfig.json** must have:
> ```json
> { "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true } }
> ```

---

## Quick Start

```ts
// main.ts — first import must be reflect-metadata
import 'reflect-metadata';
import { Elysia } from 'elysia';
import { Module, createElysiaModule } from 'elysia-modules';
import { UserModule } from './user/user.module';
import { GlobalFilter } from './common/global.filter';

@Module({ imports: [UserModule] })
class AppModule {}

const app = new Elysia();
await app.use(
  createElysiaModule(AppModule, {
    globalFilters:       [GlobalFilter],
    enableShutdownHooks: true,
  })
);
app.listen(3000);
```

---

## Lifecycle Hooks

Implement any combination of the four lifecycle interfaces on services, controllers, or the root module itself.

```ts
import { Injectable } from 'elysia-modules';
import type { OnModuleInit, OnModuleDestroy } from 'elysia-modules';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private conn: Connection;

  async onModuleInit() {
    this.conn = await connect('postgres://localhost/mydb');
    console.log('DB connected');
  }

  async onModuleDestroy() {
    await this.conn.close();
    console.log('DB disconnected');
  }
}
```

| Hook | When |
|---|---|
| `onModuleInit()` | After all providers in the module are instantiated |
| `onApplicationBootstrap()` | After ALL modules are loaded, just before the server listens |
| `onModuleDestroy()` | On SIGINT / SIGTERM (when `enableShutdownHooks: true`) |
| `onApplicationShutdown(signal?)` | Same as above, receives the OS signal string |

Enable automatic SIGINT/SIGTERM handling:

```ts
await app.use(createElysiaModule(AppModule, { enableShutdownHooks: true }));
```

---

## Middleware

Create a class that implements `ElysiaMiddleware` and decorate it with `@Injectable()`.

```ts
import { Injectable } from 'elysia-modules';
import type { ElysiaMiddleware, MiddlewareNext } from 'elysia-modules';

@Injectable()
export class AuthMiddleware implements ElysiaMiddleware {
  async use(ctx: Record<string, any>, next: MiddlewareNext) {
    if (!ctx.headers?.authorization?.startsWith('Bearer ')) {
      ctx.set.status = 401;
      return;           // ← skip next() to short-circuit
    }
    await next();       // ← continue to handler
  }
}
```

Apply at **controller level** (all routes) or **route level** (single handler):

```ts
@UseMiddleware(LoggingMiddleware)      // ← runs for every route
@Controller('/posts')
export class PostController {

  @Post('/')
  @UseMiddleware(AuthMiddleware)       // ← only on POST /posts
  create(@Body() body: CreatePostDto) { ... }
}
```

> ⚠️ Middleware classes must be listed in the module's `providers` array.

---

## Validation (Zod)

Decorate route handlers with `@ValidateBody`, `@ValidateQuery`, or `@ValidateParams`.
On failure, a structured `422 Unprocessable Entity` is returned automatically — the handler is never called.
On success, the parsed (and coerced) values replace the raw ctx values.

```ts
import { z } from 'zod';

const CreatePostSchema = z.object({
  title:    z.string().min(3).max(120),
  body:     z.string().min(1),
  authorId: z.coerce.number().int().positive(),
});

@Post('/')
@ValidateBody(CreatePostSchema)
create(@Body() body: z.infer<typeof CreatePostSchema>) {
  return this.postService.create(body); // body is already validated & typed
}
```

**422 response shape:**
```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "errors": [
    {
      "target": "body",
      "issues": [{ "code": "too_small", "path": ["title"], "message": "String must contain at least 3 character(s)" }]
    }
  ]
}
```

Multiple validations on one handler:

```ts
@Get('/')
@ValidateQuery(z.object({ page: z.coerce.number().min(1).default(1) }))
@ValidateParams(z.object({ id: z.coerce.number() }))
findOne(@Query() q: { page: number }, @Params('id') id: number) { ... }
```

---

## Exception Filters

### Built-in HTTP exceptions

Throw these anywhere in a handler — the default handler (or your global filter) catches them:

```ts
import {
  NotFoundException, ForbiddenException, BadRequestException,
  UnauthorizedException, ConflictException, InternalServerErrorException,
} from 'elysia-modules';

findOne(id: number) {
  const user = this.userService.findOne(id);
  if (!user) throw new NotFoundException(`User #${id} not found`);
  return user;
}
```

### Creating a filter

```ts
import { Catch } from 'elysia-modules';
import type { ExceptionFilter } from 'elysia-modules';

@Catch(NotFoundException)               // handle only NotFoundException
export class NotFoundFilter implements ExceptionFilter<NotFoundException> {
  catch(exception: NotFoundException, ctx: Record<string, any>) {
    ctx.set.status = 404;
    return { error: 'Not Found', message: exception.message };
  }
}

@Catch()                                // catch-all
export class GlobalFilter implements ExceptionFilter {
  catch(exception: unknown, ctx: Record<string, any>) {
    ctx.set.status = 500;
    return { error: 'Internal Server Error' };
  }
}
```

### Applying filters

```ts
// Controller-wide
@UseFilter(NotFoundFilter)
@Controller('/users')
export class UserController { ... }

// Single route (takes priority over controller-level)
@Delete('/:id')
@UseFilter(ForbiddenFilter)
remove(@Params('id') id: string) { ... }

// Global (via createElysiaModule options — lowest priority, always runs last)
await app.use(createElysiaModule(AppModule, { globalFilters: [GlobalFilter] }));
```

**Filter priority:** route-level → controller-level → global

---

## CLI

Install globally or use via `npx`:

```bash
# Global install
bun add -g elysia-modules
# or
npm install -g elysia-modules
```

### Commands

```bash
# Scaffold a full module (module + controller + service)
elysia-modules generate:module user
elysia-modules g:m user src/features/user    # custom output dir

# Individual files
elysia-modules generate:controller user
elysia-modules generate:service    user
elysia-modules generate:middleware auth  src/common/middlewares
elysia-modules generate:filter     global src/common/filters

# Aliases
elysia-modules g:c  user
elysia-modules g:s  user
elysia-modules g:mw auth
elysia-modules g:f  global
```

Example output for `elysia-modules g:m post`:
```
✔  Created: src/post/post.module.ts
✔  Created: src/post/post.controller.ts
✔  Created: src/post/post.service.ts
ℹ  Module PostModule scaffolded in src/post/
```

---

## Full API Reference

### `createElysiaModule(RootModule, options?)`

| Option | Type | Description |
|---|---|---|
| `globalFilters` | `Constructor<ExceptionFilter>[]` | Filters applied after all scoped filters |
| `enableShutdownHooks` | `boolean` | Auto-register SIGINT/SIGTERM listeners |

### `@Module(options)`

| Option | Type | Description |
|---|---|---|
| `imports` | `Constructor[]` | Other modules to import |
| `controllers` | `Constructor[]` | Controllers to register |
| `providers` | `Provider[]` | Services, middlewares, values, factories |
| `exports` | `(Token\|Constructor)[]` | Providers to expose to importing modules |

### HTTP Method Decorators
`@Get(path)` `@Post(path)` `@Put(path)` `@Delete(path)` `@Patch(path)` `@Head(path)` `@Options(path)`

### Parameter Decorators
`@Body(key?)` `@Query(key?)` `@Params(key?)` `@Headers(key?)` `@Cookie(key?)` `@Req()` `@Res()` `@Ctx()`

### Validation Decorators
`@ValidateBody(schema)` `@ValidateQuery(schema)` `@ValidateParams(schema)`

### Middleware
`@UseMiddleware(...classes)` — method or class decorator

### Exception Filters
`@Catch(...ErrorTypes)` — marks a class as a filter  
`@UseFilter(...classes)` — method or class decorator

### Built-in Exceptions
`HttpException` • `BadRequestException` (400) • `UnauthorizedException` (401) • `ForbiddenException` (403) • `NotFoundException` (404) • `ConflictException` (409) • `UnprocessableEntityException` (422) • `TooManyRequestsException` (429) • `InternalServerErrorException` (500) • `NotImplementedException` (501) • `ServiceUnavailableException` (503)

---

## License

MIT
# elysia_modules
