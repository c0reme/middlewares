import {
  ApplyMiddlewareOptions,
  isEveryByHookPayload,
  isEveryByValuePayload,
  isFilterByHookPayload,
  isFilterByValuePayload,
  isFindByHookPayload,
  isFindByValuePayload,
  isMapByHookPayload,
  isMapByPathPayload,
  isPayloadWithData,
  isRemoveByHookPayload,
  isRemoveByValuePayload,
  JoshMiddleware,
  JoshMiddlewareStore,
  JoshProvider,
  Method,
  Payload,
  PostProvider,
  PreProvider,
  resolveVersion,
  Semver
} from '@joshdb/provider';
import { addExitCallback } from 'catch-exit';
import { getProperty } from 'property-helpers';

@ApplyMiddlewareOptions({ name: 'cache' })
export class CacheMiddleware<StoredValue = unknown> extends JoshMiddleware<CacheMiddleware.ContextData<StoredValue>, StoredValue> {
  public pollingInterval?: NodeJS.Timer;

  public get version(): Semver {
    return resolveVersion('[VI]{version}[/VI]');
  }

  public override async init(store: JoshMiddlewareStore<StoredValue>) {
    await super.init(store);
    await this.fetchCache();

    return this;
  }

  public async fetchVersion() {
    const { provider: cache } = this.context;
    const versionPayload = await cache[Method.Random]({ method: Method.Random, errors: [], count: 1, duplicates: true });

    if (isPayloadWithData<CacheMiddleware.Document<StoredValue>[]>(versionPayload)) {
      const { data } = versionPayload;

      if (data.length > 0) {
        return data[0].version;
      }
    }

    return this.version;
  }

  @PreProvider()
  public override async [Method.Get]<Value = StoredValue>(payload: Payload.Get<Value>): Promise<Payload.Get<Value>> {
    const { key, path } = payload;
    const { provider: cache } = this.context;
    const getPayload = await cache[Method.Get]<CacheMiddleware.Document<Value>>({ method: Method.Get, key, path, errors: [] });

    payload.errors = [...payload.errors, ...getPayload.errors];

    if (isPayloadWithData<CacheMiddleware.Document<Value>>(getPayload)) {
      const { data } = getPayload;

      if (await this.isNotExpired(data, key)) payload.data = data.value;
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Each](payload: Payload.Each<StoredValue>): Promise<Payload.Each<StoredValue>> {
    const { hook } = payload;
    const { provider: cache } = this.context;
    const cacheHook = async (value: CacheMiddleware.Document<StoredValue>, key: string) => {
      if (await this.isNotExpired(value, key)) {
        return hook(value.value, key);
      }

      const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

      if (isPayloadWithData<StoredValue>(bypassPayload)) {
        const { data } = bypassPayload;

        return hook(data, key);
      }
    };

    const { errors } = await cache[Method.Each]({ method: Method.Each, hook: cacheHook, errors: [] });

    payload.metadata ??= {};
    payload.metadata.skipProvider = true;
    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PreProvider()
  public override async [Method.Has](payload: Payload.Has): Promise<Payload.Has> {
    const { key, path } = payload;
    const { provider: cache } = this.context;
    const getPayload = await cache[Method.Get]({ method: Method.Get, key, path, errors: [] });

    if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(getPayload) && (await this.isNotExpired(getPayload.data, key))) {
      const { data: hasData, errors } = await cache[Method.Has]({ method: Method.Has, key, path: ['value', ...path], errors: [] });

      payload.data = hasData;
      payload.errors = [...payload.errors, ...errors];
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Entries](payload: Payload.Entries<StoredValue>): Promise<Payload.Entries<StoredValue>> {
    const { provider: cache } = this.context;
    const entriesPayload = await cache[Method.Entries]({ method: Method.Entries, errors: [] });

    payload.errors = [...payload.errors, ...entriesPayload.errors];

    if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(entriesPayload)) {
      const { data } = entriesPayload;

      payload.data ??= {};

      for (const [key, val] of Object.entries(data)) {
        if (await this.isNotExpired(val, key)) {
          payload.data[key] = val.value;
        } else {
          const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

          if (isPayloadWithData<StoredValue>(bypassPayload)) {
            const { data } = bypassPayload;

            payload.data[key] = data;
          }
        }
      }
    }

    return payload;
  }

  public override async [Method.Every](payload: Payload.Every.ByHook<StoredValue>): Promise<Payload.Every.ByHook<StoredValue>>;
  public override async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;

  @PreProvider()
  public override async [Method.Every](payload: Payload.Every<StoredValue>): Promise<Payload.Every<StoredValue>> {
    const { provider: cache } = this.context;
    const cacheHook = (hook: Payload.Hook<StoredValue, unknown>) => {
      return async (value: CacheMiddleware.Document<StoredValue>, key: string) => {
        if (await this.isNotExpired(value, key)) {
          return hook(value.value, key);
        }

        const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

        if (isPayloadWithData<StoredValue>(bypassPayload)) {
          const { data } = bypassPayload;

          return hook(data, key);
        }

        return true;
      };
    };

    if (isEveryByHookPayload(payload)) {
      const { hook, type } = payload;
      const { data, errors } = await cache[Method.Every]({ method: Method.Every, type, hook: cacheHook(hook), errors: [] });

      payload.data = data;
      payload.errors = [...payload.errors, ...errors];
    }

    if (isEveryByValuePayload(payload)) {
      const { path, value } = payload;
      const valueHook = (storedValue: StoredValue) => {
        const data = getProperty(storedValue, path);

        return data === value;
      };

      const { data, errors } = await cache[Method.Every]({
        method: Method.Every,
        type: Payload.Type.Hook,
        hook: cacheHook(valueHook),
        errors: []
      });

      payload.data = data;
      payload.errors = [...payload.errors, ...errors];
    }

    return payload;
  }

  public override async [Method.Filter](payload: Payload.Filter.ByHook<StoredValue>): Promise<Payload.Filter.ByHook<StoredValue>>;
  public override async [Method.Filter](payload: Payload.Filter.ByValue<StoredValue>): Promise<Payload.Filter.ByValue<StoredValue>>;

  @PreProvider()
  public override async [Method.Filter](payload: Payload.Filter<StoredValue>): Promise<Payload.Filter<StoredValue>> {
    const { provider: cache } = this.context;

    if (isFilterByHookPayload(payload)) {
      const { hook, type } = payload;

      payload.data ??= {};

      const cacheHook = async (value: CacheMiddleware.Document<StoredValue>, key: string) => {
        payload.data ??= {};
        if ((await this.isNotExpired(value, key)) && (await hook(value.value, key))) {
          payload.data[key] = value.value;
        }

        const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

        if (isPayloadWithData<StoredValue>(bypassPayload)) {
          const { data } = bypassPayload;

          if (await hook(data, key)) {
            payload.data ??= {};
            payload.data[key] = data;
          }
        }

        return false;
      };

      const { errors } = await cache[Method.Filter]({ method: Method.Filter, hook: cacheHook, type, errors: [] });

      payload.errors = [...payload.errors, ...errors];
    }

    if (isFilterByValuePayload(payload)) {
      const { path, value, type } = payload;
      const filterPayload = await cache[Method.Filter]({
        method: Method.Filter,
        type,
        data: {},
        value,
        path: ['value', ...path],
        errors: []
      });

      if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(filterPayload)) {
        const { data } = filterPayload;

        payload.data ??= {};
        for (const [key, val] of Object.entries(data)) {
          if (await this.isNotExpired(val, key)) {
            payload.data[key] = val.value;
          } else {
            const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path, errors: [] });

            if (isPayloadWithData<StoredValue>(bypassPayload)) {
              const { data } = bypassPayload;

              payload.data[key] = data;
            }
          }
        }
      }

      payload.errors = [...payload.errors, ...filterPayload.errors];
    }

    return payload;
  }

  public override async [Method.Find](payload: Payload.Find.ByHook<StoredValue>): Promise<Payload.Find.ByHook<StoredValue>>;
  public override async [Method.Find](payload: Payload.Find.ByValue<StoredValue>): Promise<Payload.Find.ByValue<StoredValue>>;
  @PreProvider()
  public override async [Method.Find](payload: Payload.Find<StoredValue>): Promise<Payload.Find<StoredValue>> {
    const { provider: cache } = this.context;

    if (isFindByHookPayload(payload)) {
      const { hook, type } = payload;
      const cacheHook = async (value: CacheMiddleware.Document<StoredValue>, key: string) => {
        if (await this.isNotExpired(value, key)) {
          if (await hook(value.value, key)) {
            payload.data = [key, value.value];
            return true;
          }
        }

        const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

        if (isPayloadWithData<StoredValue>(bypassPayload)) {
          const { data } = bypassPayload;

          if (await hook(data, key)) {
            payload.data = [key, data];
            return true;
          }
        }

        return false;
      };

      const { errors } = await cache[Method.Find]({ method: Method.Find, hook: cacheHook, type, errors: [] });

      payload.errors = [...payload.errors, ...errors];
    }

    if (isFindByValuePayload(payload)) {
      const { path, type, value } = payload;
      const findPayload = await cache[Method.Find]({
        method: Method.Find,
        type,
        value,
        path: ['value', ...path],
        errors: []
      });

      if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(findPayload) && findPayload.data[0] !== null) {
        const [key, value] = findPayload.data;

        if (await this.isNotExpired(value, key)) {
          payload.data = [key, value.value];
        } else {
          const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path, errors: [] });

          if (isPayloadWithData<StoredValue>(bypassPayload)) {
            const { data: bypassData } = bypassPayload;

            payload.data = [key, bypassData];
          }
        }
      }

      payload.errors = [...payload.errors, ...findPayload.errors];
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Keys](payload: Payload.Keys): Promise<Payload.Keys> {
    const { provider: cache } = this.context;

    await this.populate();

    const keysPayload = await cache[Method.Keys]({ method: Method.Keys, errors: [] });

    if (isPayloadWithData(keysPayload)) {
      const { data } = keysPayload;

      payload.data = data;
    }

    const { errors } = keysPayload;

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PreProvider()
  public override async [Method.Values](payload: Payload.Values<StoredValue>): Promise<Payload.Values<StoredValue>> {
    const { provider: cache } = this.context;

    await this.populate();

    const valuesPayload = await cache[Method.Values]({ method: Method.Values, errors: [] });

    if (isPayloadWithData<CacheMiddleware.Document<StoredValue>[]>(valuesPayload)) {
      const { data } = valuesPayload;

      payload.data = data.map(({ value }) => value);
    }

    const { errors } = valuesPayload;

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  public override async [Method.Map]<Value = StoredValue>(
    payload: Payload.Map.ByHook<StoredValue, Value>
  ): Promise<Payload.Map.ByHook<StoredValue, Value>>;

  public override async [Method.Map]<Value = StoredValue>(payload: Payload.Map.ByPath<Value>): Promise<Payload.Map.ByPath<Value>>;
  @PreProvider()
  public override async [Method.Map]<ReturnValue = StoredValue>(
    payload: Payload.Map<StoredValue, ReturnValue>
  ): Promise<Payload.Map<StoredValue, ReturnValue>> {
    const { provider: cache } = this.context;

    if (isMapByHookPayload(payload)) {
      const { hook, type } = payload;
      const mapped: ReturnValue[] = [];
      const cacheHook = async (value: CacheMiddleware.Document<StoredValue>, key: string) => {
        if (await this.isNotExpired(value, key)) {
          return mapped.push(await hook(value.value, key));
        }

        const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

        if (isPayloadWithData<StoredValue>(bypassPayload)) {
          const { data: bypassData } = bypassPayload;

          mapped.push(await hook(bypassData, key));
        }

        return null;
      };

      const { errors } = await cache[Method.Map]({ method: Method.Map, hook: cacheHook, type, errors: [] });

      payload.data = mapped;

      payload.errors = [...payload.errors, ...errors];
    }

    if (isMapByPathPayload(payload)) {
      const { path } = payload;
      const mapped: ReturnValue[] = [];
      const cacheHook = async (value: CacheMiddleware.Document<StoredValue>, key: string) => {
        if (await this.isNotExpired(value, key)) {
          return mapped.push(getProperty(value.value, path) as ReturnValue);
        }

        const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path, errors: [] });

        if (isPayloadWithData<StoredValue>(bypassPayload)) {
          const { data: bypassData } = bypassPayload;

          mapped.push(bypassData as ReturnValue);
        }

        return null;
      };

      const { errors } = await cache[Method.Each]({
        method: Method.Each,
        hook: cacheHook,
        errors: []
      });

      payload.data = mapped;

      payload.errors = [...payload.errors, ...errors];
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.GetMany](payload: Payload.GetMany<StoredValue>): Promise<Payload.GetMany<StoredValue>> {
    payload.data ??= {};

    const { provider: cache } = this.context;
    const { keys } = payload;

    for (const key of keys) {
      const getPayload = await cache[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

      payload.errors = [...payload.errors, ...getPayload.errors];

      if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(getPayload) && (await this.isNotExpired(getPayload.data, key))) {
        payload.data[key] = getPayload.data.value;
      } else {
        const bypassPayload = await this.provider[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

        if (isPayloadWithData<StoredValue>(bypassPayload)) {
          const { data: bypassData } = bypassPayload;

          payload.data[key] = bypassData;
        }
      }
    }

    return payload;
  }

  @PostProvider()
  public override async [Method.Clear](payload: Payload.Clear): Promise<Payload.Clear> {
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Clear]({ method: Method.Clear, errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.Set]<Value = StoredValue>(payload: Payload.Set<Value>): Promise<Payload.Set<Value>> {
    const { key, value, path } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Set]<CacheMiddleware.Document<Value>>({
      method: Method.Set,
      key,
      path,
      value: { created: new Date().toISOString(), value, version: this.version },
      errors: []
    });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    const { entries, overwrite } = payload;
    const { provider: cache } = this.context;
    const data: Payload.SetMany.KeyPathValue[] = [];

    for (const { key, path, value } of entries) {
      if (path.length === 0) {
        const doc = { created: new Date().toISOString(), key, value };

        data.push({ key, path: [], value: doc });
      } else {
        data.push({ key, path: ['value', ...path], value });
      }
    }

    const { errors } = await cache[Method.SetMany]({ method: Method.SetMany, entries: data, overwrite, errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
    const { key, path } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Inc]({ method: Method.Inc, key, path: ['value', ...path], errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
    const { key, path } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Dec]({ method: Method.Dec, key, path: ['value', ...path], errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.Delete](payload: Payload.Delete): Promise<Payload.Delete> {
    const { key, path } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Delete]({ method: Method.Delete, key, path: path.length > 0 ? ['value', ...path] : [], errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.DeleteMany](payload: Payload.DeleteMany): Promise<Payload.DeleteMany> {
    const { keys } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.DeleteMany]({ method: Method.DeleteMany, keys, errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.Push]<Value>(payload: Payload.Push<Value>): Promise<Payload.Push<Value>> {
    const { key, value, path } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Push]({
      method: Method.Push,
      key,
      path: ['value', ...path],
      value,
      errors: []
    });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  @PostProvider()
  public override async [Method.Math](payload: Payload.Math): Promise<Payload.Math> {
    const { key, path, operand, operator } = payload;
    const { provider: cache } = this.context;
    const { errors } = await cache[Method.Math]({ method: Method.Math, key, path: ['value', ...path], operand, operator, errors: [] });

    payload.errors = [...payload.errors, ...errors];

    return payload;
  }

  public override async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove.ByHook<Value>): Promise<Payload.Remove.ByHook<Value>>;
  public override async [Method.Remove](payload: Payload.Remove.ByValue): Promise<Payload.Remove.ByValue>;

  @PostProvider()
  public override async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove<Value>): Promise<Payload.Remove<Value>> {
    const { key, path } = payload;
    const { provider: cache } = this.context;
    const getPayload = await cache[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

    if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(getPayload) && (await this.isNotExpired(getPayload.data, key))) {
      if (isRemoveByHookPayload(payload)) {
        const { hook, type } = payload;
        const { errors } = await cache[Method.Remove]({ method: Method.Remove, key, path: ['value', ...path], type, hook, errors: [] });

        payload.errors = [...payload.errors, ...errors];
      }

      if (isRemoveByValuePayload(payload)) {
        const { type, value } = payload;
        const { errors } = await cache[Method.Remove]({ method: Method.Remove, key, path: ['value', ...path], type, value, errors: [] });

        payload.errors = [...payload.errors, ...errors];
      }
    }

    return payload;
  }

  @PostProvider()
  public override async [Method.Update]<Value = StoredValue>(
    payload: Payload.Update<StoredValue, Value>
  ): Promise<Payload.Update<StoredValue, Value>> {
    const { key, hook } = payload;
    const { provider: cache } = this.context;
    const getPayload = await cache[Method.Get]({ method: Method.Get, key, path: [], errors: [] });

    payload.errors = [...payload.errors, ...getPayload.errors];

    if (isPayloadWithData<CacheMiddleware.Document<StoredValue>>(getPayload) && (await this.isNotExpired(getPayload.data, key))) {
      const newValue = await hook(getPayload.data.value, key);
      const { errors } = await this[Method.Set]({ method: Method.Set, key, value: newValue, path: [], errors: [] });

      payload.errors = [...payload.errors, ...errors];
    }

    return payload;
  }

  private async isNotExpired(data: CacheMiddleware.Document<unknown>, key: string): Promise<boolean> {
    if (!this.context.ttl) return true;
    if (new Date().getTime() - new Date(data.created).getTime() <= (this.context.ttl.timeout ?? 1000)) return true;

    const { provider: cache } = this.context;

    await cache[Method.Delete]({ method: Method.Delete, key, path: [], errors: [] });

    return false;
  }

  private async populate(): Promise<void> {
    const { provider: cache } = this.context;

    await cache[Method.Clear]({ method: Method.Clear, errors: [] });

    const entriesPayload = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

    if (isPayloadWithData<Record<string, StoredValue>>(entriesPayload)) {
      const { data } = entriesPayload;

      await this[Method.SetMany]({
        method: Method.SetMany,
        entries: Object.entries(data).map(([key, value]) => ({ key, value, path: [] })),
        overwrite: true,
        errors: []
      });
    }
  }

  private async fetchCache() {
    if (this.context.fetchAll || this.context.fetchAll === undefined) {
      await this.populate();
    }

    if (this.context.polling) {
      this.startPolling();
    }
  }

  private startPolling() {
    this.pollingInterval = setInterval(() => this.populate(), this.context.polling?.interval ?? 10000);
    addExitCallback(() => {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    });
  }
}

export namespace CacheMiddleware {
  export interface PollingOptions {
    /**
     * At what time interval to fetch all data from the provider
     * @since 1.0.0
     * @default 10000
     */
    interval?: number;
  }

  export interface TTLOptions {
    /**
     * At what time interval to fetch all data from the provider
     * @since 1.0.0
     * @default 1000
     */
    timeout?: number;
  }

  export interface Document<StoredValue> {
    /**
     * The type of value stored in the cache
     * @since 1.0.0
     */
    value: StoredValue;

    /**
     * The serialized time the document was stored in cache
     * @since 1.0.0
     */
    created: string;

    /**
     * The version of @joshdb/cache that made the document
     */
    version: Semver;
  }

  export interface ContextData<StoredValue> extends JoshMiddleware.Context {
    /**
     * The JoshProvider to use for cache
     * @since 1.0.0
     */
    provider: JoshProvider<Document<StoredValue>>;

    /**
     * When true, fetches all entries from the provider on startup
     * @since 1.0.0
     * @default true
     */
    fetchAll: boolean;

    /**
     * When enabled fetches from the cache provider on a set interval
     * @since 1.0.0
     */
    polling?: PollingOptions;

    /**
     * When enabled invalidates entries from the cache provider when they expire
     * @since 1.0.0
     */
    ttl?: TTLOptions;
  }
}
