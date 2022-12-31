import {
  ApplyMiddlewareOptions,
  isPayloadWithData,
  JoshMiddleware,
  Method,
  Payload,
  PostProvider,
  PreProvider,
  resolveVersion,
  Semver
} from '@joshdb/provider';
import { mergeDefault } from '@sapphire/utilities';

@ApplyMiddlewareOptions({ name: 'autoEnsure' })
export class AutoEnsureMiddleware<StoredValue = unknown> extends JoshMiddleware<AutoEnsureMiddleware.ContextData<StoredValue>, StoredValue> {
  public get version(): Semver {
    return resolveVersion('[VI]{version}[/VI]');
  }

  @PreProvider()
  public override async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  @PostProvider()
  public override async [Method.Get]<Value = StoredValue>(payload: Payload.Get<Value>): Promise<Payload.Get<Value>> {
    if (isPayloadWithData(payload)) return payload;

    const { key } = payload;
    const { defaultValue } = this.context;

    await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    payload.data = defaultValue as unknown as Value;

    return payload;
  }

  @PostProvider()
  public override async [Method.GetMany](payload: Payload.GetMany<StoredValue>): Promise<Payload.GetMany<StoredValue>> {
    payload.data ??= {};

    const { defaultValue } = this.context;

    for (const key of payload.keys) {
      if (key in payload.data && payload.data[key] !== null) continue;

      await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

      payload.data[key] = defaultValue;
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  @PreProvider()
  public override async [Method.Push]<Value>(payload: Payload.Push<Value>): Promise<Payload.Push<Value>> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  @PreProvider()
  public override async [Method.Math](payload: Payload.Math): Promise<Payload.Math> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  public override async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove.ByHook<Value>): Promise<Payload.Remove.ByHook<Value>>;
  public override async [Method.Remove](payload: Payload.Remove.ByValue): Promise<Payload.Remove.ByValue>;

  @PreProvider()
  public override async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove<Value>): Promise<Payload.Remove<Value>> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  @PreProvider()
  public override async [Method.Set]<Value = StoredValue>(payload: Payload.Set<Value>): Promise<Payload.Set<Value>> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  @PreProvider()
  public override async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    const { entries } = payload;
    const { defaultValue, ensureProperties } = this.context;

    for (const { key } of entries) {
      if (ensureProperties) {
        const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

        if (!isPayloadWithData(getPayload)) {
          await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

          continue;
        }

        const { data } = getPayload;

        await this.provider[Method.Set]({
          method: Method.Set,
          errors: [],
          key,
          path: [],
          value: mergeDefault(defaultValue as object, data as object)
        });
      } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Update]<Value = StoredValue>(
    payload: Payload.Update<StoredValue, Value>
  ): Promise<Payload.Update<StoredValue, Value>> {
    const { key } = payload;
    const { defaultValue, ensureProperties } = this.context;

    if (ensureProperties) {
      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) {
        await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

        return payload;
      }

      const { data } = getPayload;

      await this.provider[Method.Set]({ method: Method.Set, errors: [], key, path: [], value: mergeDefault(defaultValue as object, data as object) });
    } else await this.provider[Method.Ensure]({ method: Method.Ensure, errors: [], key, defaultValue });

    return payload;
  }

  protected fetchVersion() {
    return this.version;
  }
}

export namespace AutoEnsureMiddleware {
  export interface ContextData<StoredValue = unknown> extends JoshMiddleware.Context {
    /**
     * The default value to set if the key does not exist.
     * @since 1.0.0
     */
    defaultValue: StoredValue;

    /**
     * Whether to merge the {@link ContextData.defaultValue} with existing values.
     * @since 1.0.0
     */
    ensureProperties?: boolean;
  }
}
