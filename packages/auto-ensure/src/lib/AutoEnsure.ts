import { ApplyMiddlewareOptions, Method, Middleware, Payloads, PostProvider, PreProvider } from '@joshdb/core';

@ApplyMiddlewareOptions({ name: 'autoEnsure' })
export class AutoEnsure<StoredValue = unknown> extends Middleware<AutoEnsure.ContextData<StoredValue>, StoredValue> {
  @PreProvider()
  public async [Method.Dec](payload: Payloads.Dec): Promise<Payloads.Dec> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  @PostProvider()
  public async [Method.Get]<Value = StoredValue>(payload: Payloads.Get<Value>): Promise<Payloads.Get<Value>> {
    if ('data' in payload) return payload;

    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });
    payload.data = defaultValue as unknown as Value;

    return payload;
  }

  @PostProvider()
  public async [Method.GetMany](payload: Payloads.GetMany<StoredValue>): Promise<Payloads.GetMany<StoredValue>> {
    payload.data ??= {};

    const { defaultValue } = this.context;

    for (const key of payload.keys) {
      if (key in payload.data && payload.data[key] !== null) continue;

      await this.provider.ensure({ method: Method.Ensure, key, defaultValue });
      payload.data[key] = defaultValue;
    }

    return payload;
  }

  @PreProvider()
  public async [Method.Inc](payload: Payloads.Inc): Promise<Payloads.Inc> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  @PreProvider()
  public async [Method.Push]<Value>(payload: Payloads.Push<Value>): Promise<Payloads.Push<Value>> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  @PreProvider()
  public async [Method.Math](payload: Payloads.Math): Promise<Payloads.Math> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove.ByHook<Value>): Promise<Payloads.Remove.ByHook<Value>>;
  public async [Method.Remove](payload: Payloads.Remove.ByValue): Promise<Payloads.Remove.ByValue>;

  @PreProvider()
  public async [Method.Remove]<Value = StoredValue>(payload: Payloads.Remove<Value>): Promise<Payloads.Remove<Value>> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  @PreProvider()
  public async [Method.Set]<Value = StoredValue>(payload: Payloads.Set<Value>): Promise<Payloads.Set<Value>> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  @PreProvider()
  public async [Method.SetMany](payload: Payloads.SetMany): Promise<Payloads.SetMany> {
    const { entries } = payload;
    const { defaultValue } = this.context;

    for (const [{ key }] of entries) await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }

  @PreProvider()
  public async [Method.Update]<Value = StoredValue>(payload: Payloads.Update<StoredValue, Value>): Promise<Payloads.Update<StoredValue, Value>> {
    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider.ensure({ method: Method.Ensure, key, defaultValue });

    return payload;
  }
}

export namespace AutoEnsure {
  export interface ContextData<StoredValue = unknown> {
    defaultValue: StoredValue;
  }
}