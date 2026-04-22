# Changelog

All notable changes to `elysia-modules` will be documented here.

## [0.2.0] — Feature Complete

### Added
- **Lifecycle hooks** — `OnModuleInit`, `OnModuleDestroy`, `OnApplicationBootstrap`, `OnApplicationShutdown` interfaces + `LifecycleRunner`
- **Middleware system** — `@UseMiddleware()` class decorator (controller-wide & per-route), `ElysiaMiddleware` interface
- **Validation** — `@ValidateBody()`, `@ValidateQuery()`, `@ValidateParams()` with Zod; auto 422 responses; value coercion applied to ctx
- **Exception filters** — `@Catch()`, `@UseFilter()` decorators; `FilterRunner` with priority chain (route → controller → global); built-in `HttpException` hierarchy (10 subclasses)
- **CLI** — `elysia-modules` binary with `generate:module`, `generate:controller`, `generate:service`, `generate:middleware`, `generate:filter` commands and short aliases
- `enableShutdownHooks` option on `createElysiaModule` for automatic SIGINT/SIGTERM handling
- `globalFilters` option on `createElysiaModule`

### Changed
- `createElysiaModule` now async (returns `Promise<Elysia>`) — use `await app.use(...)`
- Factory execution order: middleware → validation → handler → exception filter

## [0.1.0] — Initial Release

### Added
- `@Module()`, `@Controller()`, `@Injectable()`, `@Inject(token)`
- HTTP method decorators: `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`, `@Head`, `@Options`
- Parameter decorators: `@Body`, `@Query`, `@Params`, `@Headers`, `@Cookie`, `@Req`, `@Res`, `@Ctx`
- `createElysiaModule(RootModule)` plugin factory
- `DIContainer` with `useClass`, `useValue`, `useFactory`
- Dual ESM + CJS build
