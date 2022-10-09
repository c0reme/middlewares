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
  Payloads,
  PostProvider,
  PreProvider
} from '@joshdb/provider';

@ApplyMiddlewareOptions({ name: 'transform' })
export class TransformMiddleware<BeforeValue = unknown, AfterValue = unknown> extends JoshMiddleware<
  TransformMiddleware.ContextData<BeforeValue, AfterValue>,
  AfterValue
> {
  // ... @PreProvider(), this gets called before the provider is called (we will use the before hook)
  @PreProvider()
  public async [Method.Each]<ReturnValue = BeforeValue>(payload: Payloads.Each<ReturnValue>): Promise<Payloads.Each<ReturnValue>> {
    const { after } = this.context;
    const hook = async (value: AfterValue, key: string) => {
      return payload.hook((await after(value, key, null)) as ReturnValue, key) as ReturnValue;
    };

    await this.provider[Method.Each]({ ...payload, hook });

    return payload;
  }

  @PreProvider()
  // @ts-expect-error 6133
  public async [Method.Ensure]<StoredValue = AfterValue>(payload: Payloads.Ensure<BeforeValue>): Promise<Payloads.Ensure<StoredValue>> {
    const { key, defaultValue } = payload;
    const { before } = this.context;

    payload.defaultValue = (await before(defaultValue as BeforeValue, key, null)) as BeforeValue;

    await this.provider[Method.Ensure](payload as unknown as Payloads.Ensure<AfterValue>);

    return payload as unknown as Payloads.Ensure<StoredValue>;
  }

  @PreProvider()
  public async [Method.Entries]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payloads.Entries<StoredValue>
  ): Promise<Payloads.Entries<ReturnValue>> {
    const { after } = this.context;
    const { data } = await this.provider[Method.Entries]({ method: Method.Entries, errors: [] });

    payload.data = {};

    for (const [key, value] of Object.entries(data!)) {
      payload.data[key] = (await after(value as AfterValue, key, null)) as StoredValue;
    }

    return payload as unknown as Payloads.Entries<ReturnValue>;
  }

  public async [Method.Map]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payloads.Map.ByHook<StoredValue, ReturnValue>
  ): Promise<Payloads.Map.ByHook<StoredValue, ReturnValue>>;

  public async [Method.Map]<ReturnValue = BeforeValue>(payload: Payloads.Map.ByPath<ReturnValue>): Promise<Payloads.Map.ByPath<ReturnValue>>;

  @PreProvider()
  public async [Method.Map]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payloads.Map<StoredValue, ReturnValue>
  ): Promise<Payloads.Map<StoredValue, ReturnValue>> {
    const { after } = this.context;

    if (isMapByHookPayload(payload)) {
      const hook = async (value: AfterValue, key: string) => {
        return payload.hook!((await after(value, key, null)) as StoredValue, key);
      };

      payload = (await this.provider[Method.Map]({ ...payload, hook })) as unknown as Payloads.Map.ByHook<StoredValue, ReturnValue>;
    } else if (isMapByPathPayload(payload)) payload = (await this.provider[Method.Map](payload)) as unknown as Payloads.Map.ByPath<ReturnValue>;

    payload.data?.map(async (v) => (await after(v as unknown as AfterValue, null, null)) as ReturnValue);

    return payload;
  }

  @PreProvider()
  public async [Method.Push]<ReturnValue = BeforeValue>(payload: Payloads.Push<ReturnValue>): Promise<Payloads.Push<ReturnValue>> {
    const { key, value } = payload;
    const { before } = this.context;

    payload.value = (await before(value as unknown as BeforeValue, key, null)) as ReturnValue;

    await this.provider[Method.Push](payload);

    return payload;
  }

  @PreProvider()
  public async [Method.Set]<StoredValue = AfterValue>(payload: Payloads.Set<StoredValue>): Promise<Payloads.Set<StoredValue>> {
    const { key, path, value } = payload;
    const { before } = this.context;

    payload.value = (await before(value as unknown as BeforeValue, key, path ?? null)) as StoredValue;

    return this.provider[Method.Set](payload);
  }

  @PreProvider()
  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    const { entries } = payload;
    const { before } = this.context;

    payload.entries = entries.map(({ key, path, value }) => ({ key, path, value: before(value as BeforeValue, key, path ?? null) }));

    return this.provider[Method.SetMany](payload);
  }

  @PreProvider()
  public async [Method.Update]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payloads.Update<StoredValue, ReturnValue>
  ): Promise<Payloads.Update<StoredValue, ReturnValue>> {
    const { key, hook } = payload;
    const { before } = this.context;

    payload.hook = (value: StoredValue) => before(hook!(value, key) as BeforeValue, key, null) as unknown as ReturnValue;

    await this.provider[Method.Update](payload as unknown as Payloads.Update<AfterValue, ReturnValue>);

    return payload;
  }

  // ... @PostProvider(), this gets called after the provider is called (we will use the after hook)
  @PostProvider()
  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
    const { key, path } = payload;

    await this.setBefore(key, path);

    await this.provider[Method.Dec](payload);

    await this.setAfter(key, path);

    return payload;
  }

  public async [Method.Every]<ReturnValue = BeforeValue>(payload: Payloads.Every.ByHook<ReturnValue>): Promise<Payloads.Every.ByHook<ReturnValue>>;
  public async [Method.Every](payload: Payloads.Every.ByValue): Promise<Payloads.Every.ByValue>;
  @PostProvider()
  public async [Method.Every]<ReturnValue = BeforeValue>(payload: Payloads.Every<ReturnValue>): Promise<Payloads.Every<ReturnValue>> {
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
    payload: Payloads.Get<StoredValue>
  ): Promise<Payloads.Get<ReturnValue>> {
    const { key, path, data } = payload;
    const { before, after, updateExisting } = this.context;

    if (data) payload.data = (await after(data as unknown as AfterValue, key, path ?? null)) as unknown as StoredValue;
    else {
      const { data } = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path });

      payload.data = (await after(data!, key, path ?? null)) as unknown as StoredValue;
    }

    if (updateExisting) await this.setBefore(key, path);
    else if (!updateExisting && (before(payload.data! as BeforeValue, key, path ?? null) as unknown as StoredValue) !== payload.data) {
      console.warn(
        'There is data within the database that has not been transformed, this may cause issues. If you wish for this to be updated automatically, set the updateExisting option to true.'
      );
    }

    return payload as unknown as Payloads.Get<ReturnValue>;
  }

  @PostProvider()
  public async [Method.GetMany]<StoredValue = AfterValue, ReturnValue = BeforeValue>(
    payload: Payloads.GetMany<StoredValue>
  ): Promise<Payloads.GetMany<ReturnValue>> {
    const { keys } = payload;
    const { after } = this.context;

    payload.data = {};

    const { data } = await this.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys });

    for (const [key, value] of Object.entries(data!)) {
      payload.data[key] = (await after(value!, key, null)) as StoredValue;
    }

    return payload as unknown as Payloads.GetMany<ReturnValue>;
  }

  @PostProvider()
  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key, path } = payload;

    await this.setBefore(key, path);

    await this.provider[Method.Inc](payload);

    await this.setAfter(key, path);

    return payload;
  }

  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key, path } = payload;

    await this.setBefore(key, path);

    await this.provider[Method.Math](payload);

    await this.setAfter(key, path);

    return payload;
  }

  @PostProvider()
  public async [Method.Random]<ReturnValue = BeforeValue>(payload: Payloads.Random<ReturnValue>): Promise<Payloads.Random<ReturnValue>> {
    const { data, count, duplicates } = payload;
    const { after } = this.context;

    if (data) payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    else {
      const { data } = await this.provider[Method.Random]({ method: Method.Random, errors: [], count, duplicates });

      payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    }

    return payload;
  }

  public async [Method.Some]<ReturnValue = BeforeValue>(payload: Payloads.Some.ByHook<ReturnValue>): Promise<Payloads.Some.ByHook<ReturnValue>>;
  public async [Method.Some](payload: Payloads.Some.ByValue): Promise<Payloads.Some.ByValue>;
  @PostProvider()
  public async [Method.Some]<ReturnValue = BeforeValue>(payload: Payloads.Some<ReturnValue>): Promise<Payloads.Some<ReturnValue>> {
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
  public async [Method.Values]<ReturnValue = BeforeValue>(payload: Payloads.Values<ReturnValue>): Promise<Payloads.Values<ReturnValue>> {
    const { data } = payload;
    const { after } = this.context;

    if (data) payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    else {
      const { data } = await this.provider[Method.Values]({ method: Method.Values, errors: [] });

      payload.data = data!.map((v) => after(v as unknown as AfterValue, null, null)) as unknown as ReturnValue[];
    }

    return payload;
  }

  // ... Utility methods
  private async setBefore(key: string, path: string[] = [], value?: BeforeValue): Promise<Payloads.Set<BeforeValue>> {
    const { after } = this.context;

    if (!value) {
      value = (await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path })).data! as unknown as BeforeValue;
    }

    value = await after(value! as any, key, path ?? null);

    return this.provider[Method.Set]({ method: Method.Set, errors: [], key, value, path });
  }

  private async setAfter(key: string, path: string[] = [], value?: AfterValue): Promise<Payloads.Set<AfterValue>> {
    const { before } = this.context;

    if (!value) {
      value = (await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path })).data!;
    }

    value = await before(value! as any, key, path ?? null);

    return this.provider[Method.Set]({ method: Method.Set, errors: [], key, value, path });
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
     * Normalises the data after it is retrieved from the provider.
     * @since 1.0.0
     */
    after: (data: AfterValue, key: string | string[] | null, path: string[] | null) => BeforeValue;

    /**
     * Manipulates any existing data to the appropriate format.
     * @since 1.0.0
     */
    updateExisting?: boolean;
  }
}
