import {
  ApplyMiddlewareOptions,
  isEveryByHookPayload,
  isEveryByValuePayload,
  isMapByHookPayload,
  isMapByPathPayload,
  isSomeByHookPayload,
  isSomeByValuePayload,
  JoshMiddleware,
  Method,
  Payload,
  PostProvider,
  PreProvider,
  resolveVersion,
  Semver
} from '@joshdb/provider';
import { arrayStrictEquals, Awaitable, objectToTuples } from '@sapphire/utilities';

@ApplyMiddlewareOptions({ name: 'transform' })
export class TransformMiddleware<BeforeValue = unknown, AfterValue = unknown> extends JoshMiddleware<
  // @ts-expect-error 2322 - 'ContextData<BeforeValue, AfterValue>' has properties in common with type 'Context', ts thinks they are incompatible
  TransformMiddleware.ContextData<BeforeValue, AfterValue>,
  AfterValue
> {
  public get version(): Semver {
    return resolveVersion('[VI]{version}[/VI]');
  }

  @PreProvider()
  public async [Method.Each]<ReturnValue = BeforeValue>(payload: Payload.Each<ReturnValue>): Promise<Payload.Each<ReturnValue>> {
    const { after } = this.context;
    const hook = async (value: AfterValue, key: string) => {
      return payload.hook((await after(value, key, null)) as ReturnValue, key) as ReturnValue;
    };

    await this.provider[Method.Each]({ ...payload, hook });

    return payload;
  }

  @PreProvider()
  public async [Method.Ensure]<ReturnValue = BeforeValue, StoredValue = AfterValue>(
    payload: Payload.Ensure<ReturnValue>
  ): Promise<Payload.Ensure<StoredValue>> {
    const { key, defaultValue } = payload;
    const { after, before } = this.context;

    payload.defaultValue = (await before(defaultValue as unknown as BeforeValue, key, null)) as ReturnValue;

    await this.provider[Method.Ensure](payload as unknown as Payload.Ensure<AfterValue>);

    const data = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    await this.provider.setMetadata(key, after(data as AfterValue, key, null));

    return payload as unknown as Payload.Ensure<StoredValue>;
  }

  @PreProvider()
  public async [Method.Entries]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payload.Entries<StoredValue>
  ): Promise<Payload.Entries<ReturnValue>> {
    const { after } = this.context;
    const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

    payload.data = {};

    for (const [key, value] of Object.entries(data!)) {
      payload.data[key] = (await after(value as AfterValue, key, null)) as StoredValue;
    }

    return payload as unknown as Payload.Entries<ReturnValue>;
  }

  public async [Method.Map]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payload.Map.ByHook<StoredValue, ReturnValue>
  ): Promise<Payload.Map.ByHook<StoredValue, ReturnValue>>;

  public async [Method.Map]<ReturnValue = BeforeValue>(payload: Payload.Map.ByPath<ReturnValue>): Promise<Payload.Map.ByPath<ReturnValue>>;

  @PreProvider()
  public async [Method.Map]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payload.Map<StoredValue, ReturnValue>
  ): Promise<Payload.Map<StoredValue, ReturnValue>> {
    const { after } = this.context;

    if (isMapByHookPayload(payload)) {
      const hook = async (value: AfterValue, key: string) => {
        // @ts-expect-error 2322 - We know that the hook is defined.
        return payload.hook!((await after(value, key, null)) as StoredValue, key);
      };

      payload = (await this.provider[Method.Map]({ ...payload, hook })) as unknown as Payload.Map.ByHook<StoredValue, ReturnValue>;
    } else if (isMapByPathPayload(payload)) payload = (await this.provider[Method.Map](payload)) as unknown as Payload.Map.ByPath<ReturnValue>;

    payload.data?.map(async (v) => (await after(v as unknown as AfterValue, null, null)) as ReturnValue);

    return payload;
  }

  @PreProvider()
  public async [Method.Push]<ReturnValue = BeforeValue>(payload: Payload.Push<ReturnValue>): Promise<Payload.Push<ReturnValue>> {
    const { key, path, value } = payload;
    const { before } = this.context;

    payload.value = (await before(value as unknown as BeforeValue, key, path)) as ReturnValue;
    await this.provider[Method.Push](payload);
    await this.updateMetadataPath(key, path);

    return payload;
  }

  @PreProvider()
  public async [Method.Set]<StoredValue = AfterValue>(payload: Payload.Set<StoredValue>): Promise<Payload.Set<StoredValue>> {
    const { key, path, value } = payload;
    const { before } = this.context;

    payload.value = (await before(value as unknown as BeforeValue, key, path ?? null)) as StoredValue;

    await this.provider[Method.Set](payload);
    if (path) {
      await this.updateMetadataPath(key, path);
      return payload;
    }

    const { data } = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    await this.updateMetadataPath(key, this.objectPathKeys(data));

    return payload;
  }

  @PreProvider()
  public async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    const { entries } = payload;
    const { before } = this.context;

    entries.forEach(async ({ key, value, path }) => {
      await this.updateMetadataPath(key, path ?? []);
      return { key, path, value: (await before(value as BeforeValue, key, path)) as unknown };
    });

    payload.entries = entries.map(({ key, path, value }) => ({ key, path, value: before(value as BeforeValue, key, path ?? null) }));
    return this.provider[Method.SetMany](payload);
  }

  @PreProvider()
  public async [Method.Update]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payload.Update<StoredValue, ReturnValue>
  ): Promise<Payload.Update<StoredValue, ReturnValue>> {
    const { key, hook } = payload;
    const { before } = this.context;
    const getBefore = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    payload.hook = (value: StoredValue) => before(hook!(value, key) as BeforeValue, key, null) as Awaitable<ReturnValue>;

    await this.provider[Method.Update](payload as unknown as Payload.Update<AfterValue, ReturnValue>);

    const getAfter = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (this.getChangedKeys(getBefore.data, getAfter.data).length) {
      await this.updateMetadataPath(key, this.getChangedKeys(getBefore.data, getAfter.data));
    }

    return payload;
  }

  @PostProvider()
  public async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
    const { after, before } = this.context;
    const { key } = payload;
    const getBefore = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });
    const beforeValue = after(getBefore.data!, key, null);

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: beforeValue });
    await this.provider[Method.Dec](payload);

    const getAfter = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });
    const afterValue = before(getAfter.data as BeforeValue, key, null);

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: afterValue });

    if (this.getChangedKeys(getBefore.data, getAfter.data).length) {
      await this.updateMetadataPath(key, this.getChangedKeys(getBefore.data, getAfter.data));
    }

    return payload;
  }

  public async [Method.Every]<ReturnValue = BeforeValue>(payload: Payload.Every.ByHook<ReturnValue>): Promise<Payload.Every.ByHook<ReturnValue>>;
  public async [Method.Every](payload: Payload.Every.ByValue): Promise<Payload.Every.ByValue>;
  @PostProvider()
  public async [Method.Every]<ReturnValue = BeforeValue>(payload: Payload.Every<ReturnValue>): Promise<Payload.Every<ReturnValue>> {
    const { before, after } = this.context;

    if (isEveryByHookPayload(payload)) {
      const hook = async (value: AfterValue, key: string) => {
        return payload.hook!((await after(value, key, null)) as ReturnValue, key);
      };

      const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

      for (const [key, value] of Object.entries(data!)) {
        if (!(await hook(value as unknown as AfterValue, key))) {
          payload.data = false;
          break;
        }

        payload.data = true;
      }
    } else if (isEveryByValuePayload(payload)) {
      const { path } = payload;
      const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

      for (const [key, value] of Object.entries(data!)) {
        const v = await after(value, key, path ?? null);

        if (!(v === payload.value && before(v, key, null) === value)) {
          payload.data = false;
          break;
        }

        payload.data = true;
      }
    }

    return payload;
  }

  @PostProvider()
  public async [Method.Get]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payload.Get<StoredValue>
  ): Promise<Payload.Get<ReturnValue>> {
    const { key, path, data } = payload;
    const { after, autoTransform } = this.context;

    if (!(await this.isTransformed(key))) {
      if (!autoTransform) {
        process.emitWarning(
          `The data at "${key}"${
            Array.isArray(path) ? ` at path "${path.join('.')}"` : ''
          } has not been transformed yet, please enable "autoTransform" to transform the data automatically or set() the data at the key to transform it.`
        );
      }
    }

    if (data) payload.data = (await after(data as unknown as AfterValue, key, path ?? null)) as unknown as StoredValue;
    else {
      const { data } = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path });

      payload.data = (await after(data!, key, path ?? null)) as unknown as StoredValue;
    }

    return payload as unknown as Payload.Get<ReturnValue>;
  }

  @PostProvider()
  public async [Method.GetMany]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payload.GetMany<StoredValue>
  ): Promise<Payload.GetMany<ReturnValue>> {
    const { keys } = payload;
    const { after } = this.context;

    payload.data = {};

    const { data } = await this.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys });

    for (const [key, value] of Object.entries(data!)) {
      payload.data[key] = (await after(value!, key, null)) as StoredValue;
    }

    return payload as unknown as Payload.GetMany<ReturnValue>;
  }

  @PostProvider()
  public async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
    const { after, before } = this.context;
    const { key } = payload;
    const getBefore = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });
    const beforeValue = after(getBefore.data!, key, null);

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: beforeValue });
    await this.provider[Method.Inc](payload);

    const getAfter = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });
    const afterValue = before(getAfter.data as BeforeValue, key, null);

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: afterValue });

    if (this.getChangedKeys(getBefore.data, getAfter.data).length) {
      await this.updateMetadataPath(key, this.getChangedKeys(getBefore.data, getAfter.data));
    }

    return payload;
  }

  public async [Method.Math](payload: Payload.Math): Promise<Payload.Math> {
    const { after, before } = this.context;
    const { key, path } = payload;
    const getBefore = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path });
    const beforeValue = after(getBefore.data!, key, null);

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: beforeValue });
    await this.provider[Method.Math](payload);

    const getAfter = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path });
    const afterValue = before(getAfter.data as BeforeValue, key, null);

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: afterValue });

    if (this.getChangedKeys(getBefore.data, getAfter.data).length) {
      await this.updateMetadataPath(key, this.getChangedKeys(getBefore.data, getAfter.data));
    }

    return payload;
  }

  @PostProvider()
  public async [Method.Random]<ReturnValue = BeforeValue>(payload: Payload.Random<ReturnValue>): Promise<Payload.Random<ReturnValue>> {
    const { data, count, duplicates } = payload;
    const { after } = this.context;

    if (data) payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    else {
      const { data } = await this.provider[Method.Random]({ method: Method.Random, errors: [], count, duplicates });

      payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    }

    return payload;
  }

  public async [Method.Some]<ReturnValue = BeforeValue>(payload: Payload.Some.ByHook<ReturnValue>): Promise<Payload.Some.ByHook<ReturnValue>>;
  public async [Method.Some](payload: Payload.Some.ByValue): Promise<Payload.Some.ByValue>;
  @PostProvider()
  public async [Method.Some]<ReturnValue = BeforeValue>(payload: Payload.Some<ReturnValue>): Promise<Payload.Some<ReturnValue>> {
    const { before, after } = this.context;

    payload.data = false;

    if (isSomeByHookPayload(payload)) {
      const hook = async (value: AfterValue, key: string) => {
        return payload.hook!((await after(value, key, null)) as ReturnValue, key);
      };

      const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

      for (const [key, value] of Object.entries(data!)) {
        if (await hook(value as unknown as AfterValue, key)) {
          payload.data = true;
          break;
        }
      }
    } else if (isSomeByValuePayload(payload)) {
      const { path } = payload;
      const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

      for (const [key, value] of Object.entries(data!)) {
        const v = await after(value, key, path ?? null);

        if (v === payload.value && before(v, key, null) === value) {
          payload.data = true;
          break;
        }
      }
    }

    return payload;
  }

  @PostProvider()
  public async [Method.Values]<ReturnValue = BeforeValue>(payload: Payload.Values<ReturnValue>): Promise<Payload.Values<ReturnValue>> {
    const { data } = payload;
    const { after } = this.context;

    if (data) payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    else {
      const { data } = await this.provider[Method.Values]({ method: Method.Values, errors: [] });

      payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    }

    return payload;
  }

  protected fetchVersion() {
    return this.version;
  }

  private objectPathKeys(obj: unknown): (string | string[])[] {
    const tuples = objectToTuples(obj as any);
    const keys = tuples.map(([k]) => {
      if ((k as string).includes('.')) return (k as string).split('.');
      return k;
    });

    return keys;
  }

  private getChangedKeys(before: unknown, after: unknown): (string | string[])[] {
    const beforeKeys = this.objectPathKeys(before);
    const afterKeys = this.objectPathKeys(after);
    const keys = [...beforeKeys, ...afterKeys].filter((k) => !beforeKeys.includes(k) || !afterKeys.includes(k));

    return keys;
  }

  private async isTransformed(key: string, path?: string[]) {
    const metadata = this.provider.getMetadata(key) as (string | string[])[];

    if (!Array.isArray(metadata)) return false;
    if (!path) {
      const { data } = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      return this.objectPathKeys(data!).every((k) => {
        if (Array.isArray(k)) {
          return metadata.some((m) => {
            if (Array.isArray(m)) return m.every((v, i) => v === k[i]);
            return m === k[0];
          });
        }

        return metadata.some((m) => m[0] === k);
      });
    }

    return metadata.some((m) => {
      if (Array.isArray(m)) return arrayStrictEquals(m, path);
      return m === path[0];
    });
  }

  private async updateMetadataPath(key: string, path: (string | string[])[]) {
    const metadata = this.provider.getMetadata(key) as (string | string[])[];

    if (!Array.isArray(metadata)) return;

    const newMetadata = metadata.filter((m) => {
      if (Array.isArray(m)) {
        return !path.some((p) => {
          if (Array.isArray(p)) return arrayStrictEquals(m, p);
          return m[0] === p;
        });
      }

      return !path.some((p) => m === p[0]);
    });

    if (newMetadata.length === 0) await this.provider.deleteMetadata(key);
    else await this.provider.setMetadata(key, newMetadata);
  }
}

export namespace TransformMiddleware {
  export interface ContextData<BeforeValue = unknown, AfterValue = unknown> {
    /**
     * Manipulates the data before it is stored by the provider.
     * @since 1.0.0
     */
    before: (data: BeforeValue, key: string | string[] | null, path: string[] | null) => AfterValue;

    /**
     * Normalizes the data after it is retrieved from the provider.
     * @since 1.0.0
     */
    after: (data: AfterValue, key: string | string[] | null, path: string[] | null) => BeforeValue;

    /**
     * Manipulates any existing data to the appropriate format.
     * @since 1.0.0
     */
    autoTransform?: boolean;
  }
}
