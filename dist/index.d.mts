import { ZodType, ZodError } from 'zod';
import { Elysia } from 'elysia';

type Constructor<T = any> = new (...args: any[]) => T;
type Token<T = any> = Constructor<T> | string | symbol;
type ClassProvider<T = any> = Constructor<T>;
interface UseClassProvider<T = any> {
    provide: Token<T>;
    useClass: Constructor<T>;
}
interface UseValueProvider<T = any> {
    provide: Token<T>;
    useValue: T;
}
interface UseFactoryProvider<T = any> {
    provide: Token<T>;
    useFactory: (...args: any[]) => T | Promise<T>;
    inject?: Token[];
}
type Provider<T = any> = ClassProvider<T> | UseClassProvider<T> | UseValueProvider<T> | UseFactoryProvider<T>;
interface ModuleOptions {
    /** Other modules whose exported providers become available here */
    imports?: Constructor[];
    /** Controllers to register routes from */
    controllers?: Constructor[];
    /** Services / providers to add to this module's DI scope */
    providers?: Provider[];
    /** Providers to expose to modules that import this one */
    exports?: (Token | Constructor)[];
}
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
interface RouteDefinition {
    method: HttpMethod;
    path: string;
    propertyKey: string;
}
type ParamType = 'body' | 'query' | 'params' | 'headers' | 'request' | 'set' | 'store' | 'cookie' | 'context';
interface ParamDefinition {
    /** Method name this param belongs to */
    methodName: string;
    /** Position in function signature */
    index: number;
    type: ParamType;
    /** Optional nested key, e.g. @Params('id') */
    key?: string;
}
/** Called once the module's providers are fully initialised */
interface OnModuleInit {
    onModuleInit(): void | Promise<void>;
}
/** Called just before the application shuts down */
interface OnModuleDestroy {
    onModuleDestroy(): void | Promise<void>;
}
/** Called after ALL modules are initialised, right before listening */
interface OnApplicationBootstrap {
    onApplicationBootstrap(): void | Promise<void>;
}
/** Called on SIGINT / SIGTERM */
interface OnApplicationShutdown {
    onApplicationShutdown(signal?: string): void | Promise<void>;
}
type MiddlewareNext = () => void | Promise<void>;
/** Implement this interface to create a class-based middleware */
interface ElysiaMiddleware {
    use(ctx: Record<string, any>, next: MiddlewareNext): void | Promise<void>;
}
interface MiddlewareDefinition {
    /** Property key of the handler this middleware applies to ('*' = all routes in controller) */
    methodName: string;
    /** Middleware constructors to apply in order */
    middlewares: Constructor<ElysiaMiddleware>[];
}
type ValidationTarget = 'body' | 'query' | 'params';
interface ValidationRule {
    target: ValidationTarget;
    schema: ZodType<any>;
}
interface ValidationDefinition {
    methodName: string;
    rules: ValidationRule[];
}
interface ValidationError {
    target: ValidationTarget;
    issues: ZodError['issues'];
}
interface ExceptionFilter<T = any> {
    catch(exception: T, ctx: Record<string, any>): unknown | Promise<unknown>;
}
interface ExceptionFilterDefinition {
    /** Error constructors this filter handles (empty = catches everything) */
    exceptions: Constructor<Error>[];
    /** The filter constructor */
    filter: Constructor<ExceptionFilter>;
}
/** Metadata stored per-controller or per-route by @UseFilter() */
interface UseFilterDefinition {
    methodName: string;
    filters: Constructor<ExceptionFilter>[];
}

/**
 * Marks a class as an Elysia module.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [DatabaseModule],
 *   controllers: [UserController],
 *   providers: [UserService],
 *   exports: [UserService],
 * })
 * export class UserModule {}
 * ```
 */
declare function Module(options?: ModuleOptions): ClassDecorator;

/**
 * Marks a class as an HTTP controller with an optional route prefix.
 *
 * @example
 * ```ts
 * @Controller('/users')
 * export class UserController {}
 * ```
 */
declare function Controller(prefix?: string): ClassDecorator;

/**
 * Marks a class as injectable (registers it in the DI system).
 * Controllers are implicitly injectable — this decorator is needed
 * only for services / providers.
 *
 * @example
 * ```ts
 * @Injectable()
 * export class UserService { ... }
 * ```
 */
declare function Injectable(): ClassDecorator;
/**
 * Overrides the automatically-inferred injection token for a constructor
 * parameter. Useful when injecting by string/symbol token or when TypeScript
 * metadata is unavailable.
 *
 * @example
 * ```ts
 * constructor(@Inject('CONFIG') private config: AppConfig) {}
 * ```
 */
declare function Inject(token: Token): ParameterDecorator;

/**
 * @example
 * ```ts
 * @Get('/') findAll() { ... }
 * @Get('/:id') findOne(@Params('id') id: string) { ... }
 * ```
 */
declare const Get: (path?: string) => MethodDecorator;
declare const Post: (path?: string) => MethodDecorator;
declare const Put: (path?: string) => MethodDecorator;
declare const Delete: (path?: string) => MethodDecorator;
declare const Patch: (path?: string) => MethodDecorator;
declare const Head: (path?: string) => MethodDecorator;
declare const Options: (path?: string) => MethodDecorator;

/**
 * Injects the full request body, or a specific key from it.
 *
 * @example
 * ```ts
 * create(@Body() dto: CreateUserDto) { ... }
 * create(@Body('name') name: string) { ... }
 * ```
 */
declare const Body: (key?: string) => ParameterDecorator;
/**
 * Injects query-string params, or a specific key.
 *
 * @example
 * ```ts
 * search(@Query('q') q: string) { ... }
 * ```
 */
declare const Query: (key?: string) => ParameterDecorator;
/**
 * Injects URL route params, or a specific key.
 *
 * @example
 * ```ts
 * findOne(@Params('id') id: string) { ... }
 * ```
 */
declare const Params: (key?: string) => ParameterDecorator;
/**
 * Injects request headers, or a specific header value.
 *
 * @example
 * ```ts
 * auth(@Headers('authorization') token: string) { ... }
 * ```
 */
declare const Headers: (key?: string) => ParameterDecorator;
/**
 * Injects cookies, or a specific cookie value.
 *
 * @example
 * ```ts
 * session(@Cookie('session_id') sessionId: string) { ... }
 * ```
 */
declare const Cookie: (key?: string) => ParameterDecorator;
/**
 * Injects the raw `Request` object.
 */
declare const Req: () => ParameterDecorator;
/**
 * Injects Elysia's `set` object (for setting status, headers on the response).
 */
declare const Res: () => ParameterDecorator;
/**
 * Injects the full Elysia context object (escape hatch).
 */
declare const Ctx: () => ParameterDecorator;

/**
 * Apply one or more class-based middlewares to a controller or a single route.
 *
 * Applied at **controller level** → runs for every route in that controller.
 * Applied at **method level**    → runs only for that route.
 *
 * Middlewares execute in the order they are listed, before the handler.
 *
 * @example
 * ```ts
 * // Functional middleware
 * @Injectable()
 * export class AuthMiddleware implements ElysiaMiddleware {
 *   use({ headers, set }: any, next: () => void) {
 *     if (!headers.authorization) { set.status = 401; return; }
 *     return next();
 *   }
 * }
 *
 * // On the whole controller
 * @UseMiddleware(AuthMiddleware)
 * @Controller('/admin')
 * export class AdminController { ... }
 *
 * // Or on a single route
 * @Get('/')
 * @UseMiddleware(LoggingMiddleware)
 * index() { ... }
 * ```
 */
declare function UseMiddleware(...middlewares: Constructor<ElysiaMiddleware>[]): ClassDecorator & MethodDecorator;

/**
 * Validates `request.body` against a Zod schema before the handler runs.
 * Returns `422 Unprocessable Entity` with structured error details on failure.
 *
 * @example
 * ```ts
 * const CreateUserDto = z.object({ name: z.string(), email: z.string().email() });
 *
 * @Post('/')
 * @ValidateBody(CreateUserDto)
 * create(@Body() body: z.infer<typeof CreateUserDto>) { ... }
 * ```
 */
declare const ValidateBody: (schema: ZodType<any>) => MethodDecorator;
/**
 * Validates query-string params against a Zod schema.
 *
 * @example
 * ```ts
 * @Get('/')
 * @ValidateQuery(z.object({ page: z.coerce.number().min(1) }))
 * list(@Query() q: { page: number }) { ... }
 * ```
 */
declare const ValidateQuery: (schema: ZodType<any>) => MethodDecorator;
/**
 * Validates URL route params against a Zod schema.
 *
 * @example
 * ```ts
 * @Get('/:id')
 * @ValidateParams(z.object({ id: z.coerce.number() }))
 * findOne(@Params('id') id: number) { ... }
 * ```
 */
declare const ValidateParams: (schema: ZodType<any>) => MethodDecorator;

/**
 * Marks a class as an exception filter.
 * Pass the error type(s) this filter handles; omit to catch everything.
 *
 * @example
 * ```ts
 * // Catch a specific error type
 * @Catch(NotFoundException)
 * export class NotFoundFilter implements ExceptionFilter<NotFoundException> {
 *   catch(exception: NotFoundException, ctx: any) {
 *     ctx.set.status = 404;
 *     return { error: exception.message };
 *   }
 * }
 *
 * // Catch-all global filter
 * @Catch()
 * export class GlobalErrorFilter implements ExceptionFilter {
 *   catch(exception: unknown, ctx: any) {
 *     console.error(exception);
 *     ctx.set.status = 500;
 *     return { error: 'Internal server error' };
 *   }
 * }
 * ```
 */
declare function Catch(...exceptions: Constructor<any>[]): ClassDecorator;
/**
 * Binds exception filter(s) to a controller (all routes) or a single route method.
 *
 * Filters are evaluated in order; the first matching filter wins.
 * Method-level filters take priority over controller-level filters.
 *
 * @example
 * ```ts
 * // Controller-wide
 * @UseFilter(NotFoundFilter, GlobalErrorFilter)
 * @Controller('/users')
 * export class UserController { ... }
 *
 * // Single route
 * @Post('/')
 * @UseFilter(ValidationExceptionFilter)
 * create(@Body() body: CreateUserDto) { ... }
 * ```
 */
declare function UseFilter(...filters: Constructor<ExceptionFilter>[]): ClassDecorator & MethodDecorator;

interface ElysiaModuleOptions {
    /** Global exception filters — applied after controller/route filters */
    globalFilters?: Constructor<ExceptionFilter>[];
    /** Register shutdown hooks (SIGINT / SIGTERM) automatically */
    enableShutdownHooks?: boolean;
}
declare function createElysiaModule(RootModule: Constructor, options?: ElysiaModuleOptions): (app: Elysia) => Promise<Elysia<"", {
    decorator: {};
    store: {};
    derive: {};
    resolve: {};
}, {
    typebox: {};
    error: {};
}, {
    schema: {};
    standaloneSchema: {};
    macro: {};
    macroFn: {};
    parser: {};
    response: {};
}, {}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
}, {
    derive: {};
    resolve: {};
    schema: {};
    standaloneSchema: {};
    response: {};
}>>;

declare class DIContainer {
    /** Resolved singleton instances */
    private readonly instances;
    /** Registered provider descriptors */
    private readonly registry;
    register(provider: Provider): void;
    resolve<T>(token: Token<T>): T;
    private instantiate;
}
declare class ElysiaModulesError extends Error {
    constructor(message: string);
}

/**
 * Runs lifecycle hooks across all registered instances in the correct order.
 *
 * Order:
 *   1. onModuleInit       — providers & controllers, depth-first module order
 *   2. onApplicationBootstrap — after all modules loaded, before listen()
 *   3. onModuleDestroy / onApplicationShutdown — on process signal
 */
declare class LifecycleRunner {
    private instances;
    /** Register an instance that may implement lifecycle interfaces */
    register(instance: unknown): void;
    runModuleInit(): Promise<void>;
    runApplicationBootstrap(): Promise<void>;
    runModuleDestroy(): Promise<void>;
    runApplicationShutdown(signal?: string): Promise<void>;
    /**
     * Registers SIGINT / SIGTERM listeners so shutdown hooks fire automatically.
     * Call this after the app starts listening.
     */
    enableShutdownHooks(): void;
}

declare class HttpException extends Error {
    readonly message: string;
    readonly statusCode: number;
    readonly details?: unknown | undefined;
    constructor(message: string, statusCode: number, details?: unknown | undefined);
    toJSON(): {
        details?: {} | null | undefined;
        statusCode: number;
        error: string;
        message: string;
    };
}
declare class BadRequestException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class UnauthorizedException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class ForbiddenException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class NotFoundException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class ConflictException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class UnprocessableEntityException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class TooManyRequestsException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class InternalServerErrorException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class NotImplementedException extends HttpException {
    constructor(message?: string, details?: unknown);
}
declare class ServiceUnavailableException extends HttpException {
    constructor(message?: string, details?: unknown);
}

export { BadRequestException, Body, Catch, ConflictException, type Constructor, Controller, Cookie, Ctx, DIContainer, Delete, type ElysiaMiddleware, type ElysiaModuleOptions, ElysiaModulesError, type ExceptionFilter, type ExceptionFilterDefinition, ForbiddenException, Get, Head, Headers, HttpException, type HttpMethod, Inject, Injectable, InternalServerErrorException, LifecycleRunner, type MiddlewareDefinition, type MiddlewareNext, Module, type ModuleOptions, NotFoundException, NotImplementedException, type OnApplicationBootstrap, type OnApplicationShutdown, type OnModuleDestroy, type OnModuleInit, Options, type ParamDefinition, type ParamType, Params, Patch, Post, type Provider, Put, Query, Req, Res, type RouteDefinition, ServiceUnavailableException, type Token, TooManyRequestsException, UnauthorizedException, UnprocessableEntityException, type UseClassProvider, type UseFactoryProvider, UseFilter, type UseFilterDefinition, UseMiddleware, type UseValueProvider, ValidateBody, ValidateParams, ValidateQuery, type ValidationDefinition, type ValidationError, type ValidationRule, type ValidationTarget, createElysiaModule };
