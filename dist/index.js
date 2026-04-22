'use strict';

require('reflect-metadata');

// src/index.ts
var META = {
  MODULE: "elysia_mod:module",
  CONTROLLER: "elysia_mod:controller",
  INJECTABLE: "elysia_mod:injectable",
  ROUTES: "elysia_mod:routes",
  PARAMS: "elysia_mod:params",
  INJECT: "elysia_mod:inject",
  MIDDLEWARE: "elysia_mod:middleware",
  VALIDATION: "elysia_mod:validation",
  FILTER: "elysia_mod:filter",
  CATCH: "elysia_mod:catch"
};
function setMeta(key, value, target) {
  Reflect.defineMetadata(key, value, target);
}
function getMeta(key, target) {
  return Reflect.getMetadata(key, target);
}
function getParamTypes(target) {
  return Reflect.getMetadata("design:paramtypes", target) ?? [];
}

// src/decorators/module.ts
function Module(options = {}) {
  return (target) => {
    setMeta(META.MODULE, options, target);
  };
}

// src/decorators/controller.ts
function Controller(prefix = "") {
  return (target) => {
    const clean = prefix.startsWith("/") ? prefix : `/${prefix}`;
    const normalised = clean === "/" ? "" : clean.replace(/\/$/, "");
    setMeta(META.CONTROLLER, normalised, target);
  };
}

// src/decorators/injectable.ts
function Injectable() {
  return (target) => {
    setMeta(META.INJECTABLE, true, target);
  };
}
function Inject(token) {
  return (target, _propertyKey, parameterIndex) => {
    const existing = getMeta(META.INJECT, target) ?? /* @__PURE__ */ new Map();
    existing.set(parameterIndex, token);
    setMeta(META.INJECT, existing, target);
  };
}

// src/decorators/methods.ts
function createMethodDecorator(httpMethod, path = "") {
  return (target, propertyKey) => {
    if (typeof propertyKey !== "string") return;
    const normalised = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
    const routes = getMeta(META.ROUTES, target.constructor) ?? [];
    routes.push({ method: httpMethod, path: normalised, propertyKey });
    setMeta(META.ROUTES, routes, target.constructor);
  };
}
var Get = (path = "") => createMethodDecorator("GET", path);
var Post = (path = "") => createMethodDecorator("POST", path);
var Put = (path = "") => createMethodDecorator("PUT", path);
var Delete = (path = "") => createMethodDecorator("DELETE", path);
var Patch = (path = "") => createMethodDecorator("PATCH", path);
var Head = (path = "") => createMethodDecorator("HEAD", path);
var Options = (path = "") => createMethodDecorator("OPTIONS", path);

// src/decorators/params.ts
function createParamDecorator(type, key) {
  return (target, propertyKey, parameterIndex) => {
    if (typeof propertyKey !== "string") return;
    const params = getMeta(META.PARAMS, target.constructor) ?? [];
    params.push({ methodName: propertyKey, index: parameterIndex, type, key });
    setMeta(META.PARAMS, params, target.constructor);
  };
}
var Body = (key) => createParamDecorator("body", key);
var Query = (key) => createParamDecorator("query", key);
var Params = (key) => createParamDecorator("params", key);
var Headers = (key) => createParamDecorator("headers", key);
var Cookie = (key) => createParamDecorator("cookie", key);
var Req = () => createParamDecorator("request");
var Res = () => createParamDecorator("set");
var Ctx = () => createParamDecorator("context");

// src/decorators/middleware.ts
function UseMiddleware(...middlewares) {
  return (target, propertyKey) => {
    const isMethod = propertyKey !== void 0;
    const methodName = isMethod ? String(propertyKey) : "*";
    const storageTarget = isMethod ? target.constructor : target;
    const existing = getMeta(META.MIDDLEWARE, storageTarget) ?? [];
    existing.push({ methodName, middlewares });
    setMeta(META.MIDDLEWARE, existing, storageTarget);
  };
}

// src/decorators/validation.ts
function createValidationDecorator(target, schema) {
  return (proto, propertyKey) => {
    if (typeof propertyKey !== "string") return;
    const existing = getMeta(META.VALIDATION, proto.constructor) ?? [];
    const entry = existing.find((e) => e.methodName === propertyKey);
    if (entry) {
      entry.rules.push({ target, schema });
    } else {
      existing.push({ methodName: propertyKey, rules: [{ target, schema }] });
    }
    setMeta(META.VALIDATION, existing, proto.constructor);
  };
}
var ValidateBody = (schema) => createValidationDecorator("body", schema);
var ValidateQuery = (schema) => createValidationDecorator("query", schema);
var ValidateParams = (schema) => createValidationDecorator("params", schema);

// src/decorators/filters.ts
function Catch(...exceptions) {
  return (target) => {
    const def = {
      exceptions,
      filter: target
    };
    setMeta(META.CATCH, def, target);
  };
}
function UseFilter(...filters) {
  return (target, propertyKey) => {
    const isMethod = propertyKey !== void 0;
    const methodName = isMethod ? String(propertyKey) : "*";
    const storageTarget = isMethod ? target.constructor : target;
    const existing = getMeta(META.FILTER, storageTarget) ?? [];
    existing.push({ methodName, filters });
    setMeta(META.FILTER, existing, storageTarget);
  };
}

// src/core/container.ts
function isUseClass(p) {
  return typeof p === "object" && "useClass" in p;
}
function isUseValue(p) {
  return typeof p === "object" && "useValue" in p;
}
function isUseFactory(p) {
  return typeof p === "object" && "useFactory" in p;
}
var DIContainer = class {
  /** Resolved singleton instances */
  instances = /* @__PURE__ */ new Map();
  /** Registered provider descriptors */
  registry = /* @__PURE__ */ new Map();
  // ── Registration ──────────────────────────────────────────────────────
  register(provider) {
    if (typeof provider === "function") {
      this.registry.set(provider, provider);
    } else if (isUseValue(provider)) {
      this.instances.set(provider.provide, provider.useValue);
    } else {
      this.registry.set(provider.provide, provider);
    }
  }
  // ── Resolution ────────────────────────────────────────────────────────
  resolve(token) {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }
    const provider = this.registry.get(token);
    if (!provider) {
      if (typeof token === "function") {
        this.register(token);
        return this.resolve(token);
      }
      throw new ElysiaModulesError(
        `No provider found for token: ${String(token?.name ?? token)}. Make sure it is listed in a module's providers array.`
      );
    }
    let instance;
    if (typeof provider === "function") {
      instance = this.instantiate(provider);
    } else if (isUseClass(provider)) {
      instance = this.instantiate(provider.useClass);
    } else if (isUseFactory(provider)) {
      const deps = (provider.inject ?? []).map((dep) => this.resolve(dep));
      instance = provider.useFactory(...deps);
    } else {
      throw new ElysiaModulesError(`Malformed provider for token: ${String(token)}`);
    }
    this.instances.set(token, instance);
    return instance;
  }
  // ── Instantiation (constructor injection) ─────────────────────────────
  instantiate(ctor) {
    const paramTypes = getParamTypes(ctor);
    const injectOverrides = getMeta(META.INJECT, ctor) ?? /* @__PURE__ */ new Map();
    const deps = paramTypes.map((type, i) => {
      const token = injectOverrides.get(i) ?? type;
      if (!token) {
        throw new ElysiaModulesError(
          `Cannot resolve dependency at index ${i} of ${ctor.name}. Either enable emitDecoratorMetadata or use @Inject(TOKEN).`
        );
      }
      return this.resolve(token);
    });
    return new ctor(...deps);
  }
};
var ElysiaModulesError = class extends Error {
  constructor(message) {
    super(`[elysia-modules] ${message}`);
    this.name = "ElysiaModulesError";
  }
};

// src/core/loader.ts
var ModuleLoader = class {
  constructor(container) {
    this.container = container;
  }
  container;
  /** Prevents double-loading the same module */
  loaded = /* @__PURE__ */ new Set();
  /** Ordered list of all resolved controller classes */
  allControllers = [];
  // ── Public ──────────────────────────────────────────────────────────────
  load(moduleClass) {
    if (this.loaded.has(moduleClass)) return;
    this.loaded.add(moduleClass);
    const options = getMeta(META.MODULE, moduleClass) ?? {};
    for (const imported of options.imports ?? []) {
      this.load(imported);
    }
    for (const provider of options.providers ?? []) {
      this.container.register(provider);
    }
    for (const controller of options.controllers ?? []) {
      this.container.register(controller);
      this.allControllers.push(controller);
    }
  }
  getControllers() {
    return this.allControllers;
  }
};

// src/core/lifecycle.ts
function hasHook(inst, hook) {
  return typeof inst?.[hook] === "function";
}
var LifecycleRunner = class {
  instances = [];
  /** Register an instance that may implement lifecycle interfaces */
  register(instance) {
    this.instances.push(instance);
  }
  // ── Init phase ────────────────────────────────────────────────────────
  async runModuleInit() {
    for (const inst of this.instances) {
      if (hasHook(inst, "onModuleInit")) {
        await inst.onModuleInit();
      }
    }
  }
  async runApplicationBootstrap() {
    for (const inst of this.instances) {
      if (hasHook(inst, "onApplicationBootstrap")) {
        await inst.onApplicationBootstrap();
      }
    }
  }
  // ── Shutdown phase ────────────────────────────────────────────────────
  async runModuleDestroy() {
    for (const inst of [...this.instances].reverse()) {
      if (hasHook(inst, "onModuleDestroy")) {
        await inst.onModuleDestroy();
      }
    }
  }
  async runApplicationShutdown(signal) {
    for (const inst of [...this.instances].reverse()) {
      if (hasHook(inst, "onApplicationShutdown")) {
        await inst.onApplicationShutdown(signal);
      }
    }
  }
  /**
   * Registers SIGINT / SIGTERM listeners so shutdown hooks fire automatically.
   * Call this after the app starts listening.
   */
  enableShutdownHooks() {
    const shutdown = async (signal) => {
      console.log(`
[elysia-modules] Received ${signal}, shutting down\u2026`);
      await this.runApplicationShutdown(signal);
      await this.runModuleDestroy();
      process.exit(0);
    };
    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  }
};

// src/core/exceptions.ts
var HttpException = class extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
  }
  message;
  statusCode;
  details;
  toJSON() {
    return {
      statusCode: this.statusCode,
      error: this.name,
      message: this.message,
      ...this.details !== void 0 ? { details: this.details } : {}
    };
  }
};
var BadRequestException = class extends HttpException {
  constructor(message = "Bad Request", details) {
    super(message, 400, details);
  }
};
var UnauthorizedException = class extends HttpException {
  constructor(message = "Unauthorized", details) {
    super(message, 401, details);
  }
};
var ForbiddenException = class extends HttpException {
  constructor(message = "Forbidden", details) {
    super(message, 403, details);
  }
};
var NotFoundException = class extends HttpException {
  constructor(message = "Not Found", details) {
    super(message, 404, details);
  }
};
var ConflictException = class extends HttpException {
  constructor(message = "Conflict", details) {
    super(message, 409, details);
  }
};
var UnprocessableEntityException = class extends HttpException {
  constructor(message = "Unprocessable Entity", details) {
    super(message, 422, details);
  }
};
var TooManyRequestsException = class extends HttpException {
  constructor(message = "Too Many Requests", details) {
    super(message, 429, details);
  }
};
var InternalServerErrorException = class extends HttpException {
  constructor(message = "Internal Server Error", details) {
    super(message, 500, details);
  }
};
var NotImplementedException = class extends HttpException {
  constructor(message = "Not Implemented", details) {
    super(message, 501, details);
  }
};
var ServiceUnavailableException = class extends HttpException {
  constructor(message = "Service Unavailable", details) {
    super(message, 503, details);
  }
};

// src/core/filters.ts
var FilterRunner = class {
  constructor(container, globalFilters = []) {
    this.container = container;
    this.globalFilters = globalFilters;
  }
  container;
  globalFilters;
  /**
   * Attempt to handle `error` using:
   *   1. Method-level filters (most specific)
   *   2. Controller-level filters
   *   3. Global filters
   *   4. Default HttpException handler
   *   5. Fallback 500
   */
  async run(error, ctx, ControllerClass, methodName) {
    const defs = getMeta(META.FILTER, ControllerClass) ?? [];
    const methodFilters = defs.filter((d) => d.methodName === methodName).flatMap((d) => d.filters);
    const controllerFilters = defs.filter((d) => d.methodName === "*").flatMap((d) => d.filters);
    const allFilters = [...methodFilters, ...controllerFilters, ...this.globalFilters];
    for (const FilterClass of allFilters) {
      const catchDef = getMeta(META.CATCH, FilterClass);
      if (catchDef && catchDef.exceptions.length > 0) {
        const matches = catchDef.exceptions.some((E) => error instanceof E);
        if (!matches) continue;
      }
      const filter = this.container.resolve(FilterClass);
      return filter.catch(error, ctx);
    }
    if (error instanceof HttpException) {
      ctx.set.status = error.statusCode;
      return error.toJSON();
    }
    console.error("[elysia-modules] Unhandled exception:", error);
    ctx.set.status = 500;
    return {
      statusCode: 500,
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
};

// src/core/validation.ts
async function runValidation(ctx, methodName, allValidations) {
  const defs = allValidations.find((v) => v.methodName === methodName);
  if (!defs) return null;
  const errors = [];
  for (const rule of defs.rules) {
    const raw = ctx[rule.target];
    const result = await rule.schema.safeParseAsync(raw);
    if (!result.success) {
      errors.push({
        target: rule.target,
        issues: result.error.issues
      });
    } else {
      ctx[rule.target] = result.data;
    }
  }
  return errors.length > 0 ? { status: 422, errors } : null;
}

// src/core/factory.ts
function resolveHandlerArgs(ctx, methodName, allParams) {
  const methodParams = allParams.filter((p) => p.methodName === methodName);
  if (methodParams.length === 0) return [ctx];
  const args = [];
  for (const param of methodParams) {
    let value;
    switch (param.type) {
      case "body":
        value = param.key ? ctx["body"]?.[param.key] : ctx["body"];
        break;
      case "query":
        value = param.key ? ctx["query"]?.[param.key] : ctx["query"];
        break;
      case "params":
        value = param.key ? ctx["params"]?.[param.key] : ctx["params"];
        break;
      case "headers":
        value = param.key ? ctx["headers"]?.[param.key] : ctx["headers"];
        break;
      case "cookie":
        value = param.key ? ctx["cookie"]?.[param.key] : ctx["cookie"];
        break;
      case "request":
        value = ctx["request"];
        break;
      case "set":
        value = ctx["set"];
        break;
      case "store":
        value = ctx["store"];
        break;
      case "context":
      default:
        value = ctx;
    }
    args[param.index] = value;
  }
  return args;
}
function joinPaths(prefix, path) {
  const joined = `${prefix}${path}`.replace(/\/+/g, "/");
  return joined !== "/" ? joined.replace(/\/$/, "") : joined;
}
async function runMiddlewares(middlewares, ctx, container) {
  for (const MwClass of middlewares) {
    let nextCalled = false;
    const instance = container.resolve(MwClass);
    await instance.use(ctx, async () => {
      nextCalled = true;
    });
    if (!nextCalled) return false;
  }
  return true;
}
function createElysiaModule(RootModule, options = {}) {
  return async (app) => {
    const container = new DIContainer();
    const lifecycle = new LifecycleRunner();
    const modLoader = new ModuleLoader(container);
    for (const f of options.globalFilters ?? []) container.register(f);
    modLoader.load(RootModule);
    const filterRunner = new FilterRunner(container, options.globalFilters ?? []);
    for (const ControllerClass of modLoader.getControllers()) {
      const prefix = getMeta(META.CONTROLLER, ControllerClass) ?? "";
      const routes = getMeta(META.ROUTES, ControllerClass) ?? [];
      const params = getMeta(META.PARAMS, ControllerClass) ?? [];
      const mwDefs = getMeta(META.MIDDLEWARE, ControllerClass) ?? [];
      const validations = getMeta(META.VALIDATION, ControllerClass) ?? [];
      const instance = container.resolve(ControllerClass);
      lifecycle.register(instance);
      const controllerMws = mwDefs.filter((d) => d.methodName === "*").flatMap((d) => d.middlewares);
      for (const route of routes) {
        const fullPath = joinPaths(prefix, route.path);
        const method = route.method.toLowerCase();
        const routeMws = mwDefs.filter((d) => d.methodName === route.propertyKey).flatMap((d) => d.middlewares);
        const allMws = [...controllerMws, ...routeMws];
        app[method](fullPath, async (ctx) => {
          try {
            const ctxMut = ctx;
            if (allMws.length > 0) {
              const passed = await runMiddlewares(allMws, ctxMut, container);
              if (!passed) return;
            }
            const validationError = await runValidation(ctxMut, route.propertyKey, validations);
            if (validationError) {
              ctxMut.set.status = 422;
              return {
                statusCode: 422,
                error: "Unprocessable Entity",
                message: "Validation failed",
                errors: validationError.errors
              };
            }
            const args = resolveHandlerArgs(ctxMut, route.propertyKey, params);
            return await instance[route.propertyKey](...args);
          } catch (err) {
            return filterRunner.run(err, ctx, ControllerClass, route.propertyKey);
          }
        });
      }
    }
    await lifecycle.runModuleInit();
    await lifecycle.runApplicationBootstrap();
    if (options.enableShutdownHooks) lifecycle.enableShutdownHooks();
    return app;
  };
}

exports.BadRequestException = BadRequestException;
exports.Body = Body;
exports.Catch = Catch;
exports.ConflictException = ConflictException;
exports.Controller = Controller;
exports.Cookie = Cookie;
exports.Ctx = Ctx;
exports.DIContainer = DIContainer;
exports.Delete = Delete;
exports.ElysiaModulesError = ElysiaModulesError;
exports.ForbiddenException = ForbiddenException;
exports.Get = Get;
exports.Head = Head;
exports.Headers = Headers;
exports.HttpException = HttpException;
exports.Inject = Inject;
exports.Injectable = Injectable;
exports.InternalServerErrorException = InternalServerErrorException;
exports.LifecycleRunner = LifecycleRunner;
exports.Module = Module;
exports.NotFoundException = NotFoundException;
exports.NotImplementedException = NotImplementedException;
exports.Options = Options;
exports.Params = Params;
exports.Patch = Patch;
exports.Post = Post;
exports.Put = Put;
exports.Query = Query;
exports.Req = Req;
exports.Res = Res;
exports.ServiceUnavailableException = ServiceUnavailableException;
exports.TooManyRequestsException = TooManyRequestsException;
exports.UnauthorizedException = UnauthorizedException;
exports.UnprocessableEntityException = UnprocessableEntityException;
exports.UseFilter = UseFilter;
exports.UseMiddleware = UseMiddleware;
exports.ValidateBody = ValidateBody;
exports.ValidateParams = ValidateParams;
exports.ValidateQuery = ValidateQuery;
exports.createElysiaModule = createElysiaModule;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map