import { ApplyMiddlewareOptions, JoshMiddleware, Method, Payloads, PostProvider, PreProvider } from '@joshdb/provider';
import type { Primitive } from '@sapphire/utilities';

@ApplyMiddlewareOptions({ name: 'transform' })
export class TransformMiddleware<StoredValue = unknown> extends JoshMiddleware<TransformMiddleware.ContextData<StoredValue>, StoredValue> {
  @PreProvider()
  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path } = payload;
    const { before } = this.context;

    await this.provider[Method.Set]({
      method: Method.Set,
      errors: [],
      key,
      path,
      value: await before(payload.value as unknown as StoredValue, null, null)
    });

    return payload;
  }

  @PreProvider()
  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    const { entries } = payload;
    const { before } = this.context;

    for (const { key, value, path } of entries) {
      await this.provider[Method.Set]({
        method: Method.Set,
        errors: [],
        key,
        path: [],
        value: await before(value as StoredValue, key, path)
      });
    }

    return payload;
  }

  @PreProvider()
  public async [Method.Update]<Value = StoredValue>(payload: Payloads.Update<StoredValue, Value>): Promise<Payloads.Update<StoredValue, Value>> {
    const { key, hook } = payload;
    const { before, after } = this.context;

    await this.provider[Method.Update]({
      method: Method.Update,
      errors: [],
      key,
      hook: async (value) => {
        const result = await hook(await after(value, key, []), key);

        return before(result as StoredValue, key, []);
      }
    });

    return payload;
  }
  // POST PROVIDER

  @PostProvider()
  public async [Method.Entries]<Value = StoredValue>(payload: Payloads.Entries<Value>): Promise<Payloads.Entries<Value>> {
    payload.data ??= {};

    const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });
    const { after } = this.context;

    for (const [key, value] of Object.entries(data!)) {
      payload.data[key] = (await after(value as StoredValue, key, null)) as Value;
    }

    return payload;
  }

  public async [Method.Every](payload: Payloads.Every.ByHook<StoredValue>): Promise<Payloads.Every.ByHook<StoredValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  @PostProvider()
  public async [Method.Every](payload: Payloads.Every<StoredValue>): Promise<Payloads.Every<StoredValue>> {
    const { type, hook, path, value } = payload;
    const { data } = await this.provider[Method.Every]({ method: Method.Every, errors: [], type, hook, path, value });

    payload.data = data;
    return payload;
  }

  public async [Method.Filter](payload: Payloads.Filter.ByHook<StoredValue>): Promise<Payloads.Filter.ByHook<StoredValue>>;
  public async [Method.Filter](payload: Payloads.Filter.ByValue<StoredValue>): Promise<Payloads.Filter.ByValue<StoredValue>>;
  @PostProvider()
  public async [Method.Filter](payload: Payloads.Filter<StoredValue>): Promise<Payloads.Filter<StoredValue>> {
    payload.data ??= {};

    const { type, hook, path, value } = payload;
    const { after, before } = this.context;
    const { data } = await this.provider[Method.Filter]({
      method: Method.Filter,
      errors: [],
      type,
      hook,
      path,
      value: (await before(value as any, null, path ?? null)) as Primitive
    });

    for (const [key, value] of Object.entries(data!)) {
      payload.data[key] = await after(value, key, path ?? null);
    }

    return payload;
  }

  public async [Method.Find](payload: Payloads.Find.ByHook<StoredValue>): Promise<Payloads.Find.ByHook<StoredValue>>;
  public async [Method.Find](payload: Payloads.Find.ByValue<StoredValue>): Promise<Payloads.Find.ByValue<StoredValue>>;
  @PostProvider()
  public async [Method.Find](payload: Payloads.Find<StoredValue>): Promise<Payloads.Find<StoredValue>> {
    // payload.data ??= [] as unknown as [null, null] | [string, StoredValue] | undefined;

    const { type, hook, path, value } = payload;
    const { after, before } = this.context;
    const { data } = await this.provider[Method.Find]({
      method: Method.Find,
      errors: [],
      type,
      hook,
      path,
      value: ((await before(value as StoredValue, null, path ?? null)) as Primitive) ?? null
    });

    for (const [key, value] of Object.entries(data!)) {
      if (!value) {
        payload.data = [null, null];
        continue;
      }

      payload.data = [key, await after(value as StoredValue, key, path ?? null)];
    }

    return payload;
  }

  @PostProvider()
  public async [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Promise<Payloads.Get<Value>> {
    const { key, path } = payload;
    const { after } = this.context;

    payload.data = (await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path })).data as Value;

    const { data } = payload;

    payload.data = (await after(data as unknown as StoredValue, key, path)) as Value;

    return payload;
  }

  @PostProvider()
  public async [Method.GetMany]<Value = StoredValue>(payload: Payloads.GetMany<Value>): Promise<Payloads.GetMany<Value>> {
    payload.data ??= {};

    const { after } = this.context;

    for (const key of payload.keys) {
      const { data, path } = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      payload.data[key] = (await after(data as unknown as StoredValue, key, path)) as Value;
    }

    return payload;
  }

  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByHook<Value, StoredValue>): Promise<Payloads.Map.ByHook<Value, StoredValue>>;
  public async [Method.Map]<Value = StoredValue>(payload: Payloads.Map.ByPath<Value>): Promise<Payloads.Map.ByPath<Value>>;
  @PostProvider()
  public async [Method.Map](payload: Payloads.Map<StoredValue, StoredValue>): Promise<Payloads.Map<StoredValue, StoredValue>> {
    const { type, hook, path } = payload;
    const { data } = await this.provider[Method.Map]({ method: Method.Map, errors: [], type, path, hook });
    const { after } = this.context;

    payload.data = data?.map(((val: StoredValue) => after(val, null, path ?? null)) as unknown as (val: StoredValue) => StoredValue);

    return payload;
  }

  @PostProvider()
  public async [Method.Random](payload: Payloads.Random<StoredValue>): Promise<Payloads.Random<StoredValue>> {
    const { count, duplicates } = payload;
    const { after } = this.context;
    const { data } = await this.provider[Method.Random]({ method: Method.Random, errors: [], count, duplicates });

    payload.data = data?.map(((val: StoredValue) => after(val, null, null)) as unknown as (val: StoredValue) => StoredValue);

    return payload;
  }

  public async [Method.Some](payload: Payloads.Some.ByHook<StoredValue>): Promise<Payloads.Some.ByHook<StoredValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;

  @PostProvider()
  public async [Method.Some]<Value = StoredValue>(payload: Payloads.Some<Value>): Promise<Payloads.Some<Value>> {
    payload.data = false;

    const { hook, path, value } = payload;

    if (value && path) {
      const { data } = await this.provider[Method.Keys]({ method: Method.Keys, errors: [] });

      for (const key of data!) {
        const { data } = await this[Method.Get]({ method: Method.Get, errors: [], key, path });

        if (data === value) payload.data = true;
      }
    } else if (hook) {
      const { data } = await this.provider[Method.Keys]({ method: Method.Keys, errors: [] });

      for (const key of data!) {
        const { data } = await this[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

        if (hook(data as Value, key)) payload.data = true;
      }
    }

    return payload;
  }

  @PostProvider()
  public async [Method.Values]<Value = StoredValue>(payload: Payloads.Values<Value>): Promise<Payloads.Values<Value>> {
    const { data } = await this.provider[Method.Values]({ method: Method.Values, errors: [] });
    const { after } = this.context;

    payload.data = data?.map(((val: StoredValue) => after(val, null, null)) as unknown as (val: StoredValue) => StoredValue) as unknown as Value[];

    return payload;
  }
}

export namespace TransformMiddleware {
  export interface ContextData<StoredValue = unknown> {
    /**
     * Manipulates the data before it is stored by the provider.
     * @since 1.0.0
     */
    before: (data: StoredValue, key: string | string[] | null, path: string[] | null) => StoredValue;

    /**
     * Normalises the data after it is retrieved from the provider.
     * @since 1.0.0
     */
    after: (data: StoredValue, key: string | string[] | null, path: string[] | null) => StoredValue;
  }
}
