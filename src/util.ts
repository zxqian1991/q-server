import { Context } from "koa";
import Router from "@koa/router";
import { IControllerInfo } from "./interfaces/controller";
import {
  COMMON_OF_CONTROLLER_INFO,
  CONTROLLER_URL_PROPERTY_NAME,
  SYMBOL_OF_CONTROLLER_PROPERY_DECORATOR,
} from "./common";
import { IControllerMethodStore } from "./interfaces/controller";
import { Ioc } from "qzx-ioc";

const CTX_SYMBOL = Symbol("ctx");

export function join(p1: string, p2: string) {
  return `${p1}/${p2}`.replace(/(?<!https:)\/{2,}/gi, "/");
}

/**
 * 根据所有的controller生成path和controller的对应关系
 */
export function getControllerPaths(prefix: string = "/") {
  return COMMON_OF_CONTROLLER_INFO.reduce<IControllerInfo>(
    (lastv, [option, target]) => {
      const store = getControllerMethodStore(target.prototype);
      const realPath = option.notUsePrefix
        ? option.path
        : join(prefix, option.path);
      for (let url in store) {
        lastv[join(realPath, url)] = {
          target,
          methods: store[url],
        };
      }
      return lastv;
    },
    {}
  );
}

export function getControllerMethodStore(target: any): IControllerMethodStore {
  if (!target[CONTROLLER_URL_PROPERTY_NAME]) {
    target[CONTROLLER_URL_PROPERTY_NAME] = {};
  }
  return target[CONTROLLER_URL_PROPERTY_NAME];
}

export function runObjectLikeArray<T>(
  obj: { [prop: string]: T },
  handler: (v: T, key: string) => void
) {
  for (let i in obj) {
    handler(obj[i], i);
  }
}

export function getParamStore(target: any, propertyKey: string) {
  return (
    (target &&
      target[SYMBOL_OF_CONTROLLER_PROPERY_DECORATOR] &&
      target[SYMBOL_OF_CONTROLLER_PROPERY_DECORATOR][propertyKey]) ||
    []
  );
}

export function getTargetConstructorParamInsts(target: any) {
  const paramsTypes: any[] =
    Reflect.getMetadata("design:paramtypes", target) || [];
  return paramsTypes.map((t) => Ioc(t));
}

export function initPathMapping(pathMapping: IControllerInfo, router: Router) {
  runObjectLikeArray(pathMapping, (v, k) => {
    for (let type in v.methods) {
      (router as any)[type](k, async (ctx: Context) => {
        const propName = (v.methods as any)[type];
        const instance: any = new v.target(
          ...getTargetConstructorParamInsts(v.target)
        );
        instance[CTX_SYMBOL] = ctx;
        const params = getParamStore(instance, propName).map(
          (handlers: Array<(ctx: Context, _v?: any) => any>) => {
            const t = handlers.reduce(
              (_v, handler) => handler(ctx, _v),
              undefined
            );
            return t;
          }
        );
        return await instance[propName].apply(instance, params);
      });
    }
  });
}

export function getIPAdress() {
  var interfaces = require("os").networkInterfaces();
  for (var devName in interfaces) {
    var iface = interfaces[devName];
    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (
        alias.family === "IPv4" &&
        alias.address !== "127.0.0.1" &&
        !alias.internal
      ) {
        return alias.address;
      }
    }
  }
}

export function getCtx<T>(ins: T): Context {
  return ins && (ins as any)[CTX_SYMBOL];
}
