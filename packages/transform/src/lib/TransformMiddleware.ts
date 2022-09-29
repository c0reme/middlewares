import { ApplyMiddlewareOptions, JoshMiddleware, Method, Payloads, PostProvider, PreProvider } from '@joshdb/provider';

@ApplyMiddlewareOptions({ name: 'transform' })
export class TransformMiddleware<StoredValue = unknown> extends JoshMiddleware<TransformMiddleware.ContextData<StoredValue>, StoredValue> {
  @PreProvider()
  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key, path } = payload;
    const { before } = this.context;

    await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path, value: await before(payload.value as unknown as StoredValue) });
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
  public async [Method.Ensure]<Value = StoredValue>(payload: Payloads.Ensure<Value>): Promise<Payloads.Ensure<Value>> {
    const { key, defaultValue } = payload;
    const { before } = this.context;

    payload.data = (await before(defaultValue as unknown as StoredValue)) as Value;

    await this.provider[Method.Ensure]({
      method: Method.Ensure,
      errors: [],
      key,
      defaultValue: payload.data as unknown as StoredValue
    });

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
}

export namespace TransformMiddleware {
  export interface ContextData<StoredValue = unknown> {
    /**
     * Manipulates the data before it is stored by the provider.
     * @since 1.0.0
     */
    before: (data: StoredValue, key?: string | string[], path?: string[]) => StoredValue;

    /**
     * Normalises the data after it is retrieved from the provider.
     * @since 1.0.0
     */
    after: (data: StoredValue, key?: string | string[], path?: string[]) => StoredValue;
  }
}
