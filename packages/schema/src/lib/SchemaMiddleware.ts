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
import { Result } from '@sapphire/result';
import type { BaseValidator } from '@sapphire/shapeshift';

@ApplyMiddlewareOptions({ name: 'schema' })
export class SchemaMiddleware<StoredValue = unknown> extends JoshMiddleware<SchemaMiddleware.ContextData<StoredValue>, StoredValue> {
  public get version(): Semver {
    return resolveVersion('[VI]{version}[/VI]');
  }

  @PreProvider()
  public override async [Method.Dec](payload: Payload.Dec): Promise<Payload.Dec> {
    const { key } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Dec, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  @PostProvider()
  public override [Method.Get]<Value = StoredValue>(payload: Payload.Get<Value>): Payload.Get<Value> {
    if (!isPayloadWithData(payload)) return payload;

    const { schema } = this.context;
    const { data } = payload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Get, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  @PostProvider()
  public override [Method.GetMany](payload: Payload.GetMany<StoredValue>): Payload.GetMany<StoredValue> {
    if (!isPayloadWithData(payload)) return payload;

    const { schema } = this.context;
    const { data } = payload;

    for (const value of Object.values(data ?? {})) {
      if (value !== null) {
        const result = Result.from(() => schema.parse(value));

        if (result.isErr()) {
          payload.errors.push(
            this.error({
              identifier: SchemaMiddleware.Identifiers.InvalidData,
              method: Method.GetMany,
              context: { shapeshiftError: result.unwrapErr() }
            })
          );
        }
      }
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Inc](payload: Payload.Inc): Promise<Payload.Inc> {
    const { key } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Inc, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Push]<Value>(payload: Payload.Push<Value>): Promise<Payload.Push<Value>> {
    const { key } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Push, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Math](payload: Payload.Math): Promise<Payload.Math> {
    const { key } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Math, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  public override async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove.ByHook<Value>): Promise<Payload.Remove.ByHook<Value>>;
  public override async [Method.Remove](payload: Payload.Remove.ByValue): Promise<Payload.Remove.ByValue>;

  @PreProvider()
  public override async [Method.Remove]<Value = StoredValue>(payload: Payload.Remove<Value>): Promise<Payload.Remove<Value>> {
    const { key } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Remove, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Set]<Value = StoredValue>(payload: Payload.Set<Value>): Promise<Payload.Set<Value>> {
    const { key, path, value } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Set, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    if (!path.length) {
      const result = Result.from(() => schema.parse(value));

      if (result.isErr()) {
        payload.errors.push(
          this.error({ identifier: SchemaMiddleware.Identifiers.InvalidValue, method: Method.Set, context: { shapeshiftError: result.unwrapErr() } })
        );
      }
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.SetMany](payload: Payload.SetMany): Promise<Payload.SetMany> {
    const { entries } = payload;
    const { schema } = this.context;

    for (const { key, value } of entries) {
      const valueResult = Result.from(() => schema.parse(value));

      if (valueResult.isErr()) {
        payload.errors.push(
          this.error({
            identifier: SchemaMiddleware.Identifiers.InvalidValue,
            method: Method.SetMany,
            context: { shapeshiftError: valueResult.unwrapErr() }
          })
        );
      }

      const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

      if (!isPayloadWithData(getPayload)) continue;

      const { data } = getPayload;
      const dataResult = Result.from(() => schema.parse(data));

      if (dataResult.isErr()) {
        payload.errors.push(
          this.error({
            identifier: SchemaMiddleware.Identifiers.InvalidData,
            method: Method.SetMany,
            context: { shapeshiftError: dataResult.unwrapErr() }
          })
        );
      }
    }

    return payload;
  }

  @PreProvider()
  public override async [Method.Update]<Value = StoredValue>(
    payload: Payload.Update<StoredValue, Value>
  ): Promise<Payload.Update<StoredValue, Value>> {
    const { key } = payload;
    const { schema } = this.context;
    const getPayload = await this.provider[Method.Get]({ method: Method.Get, errors: [], key, path: [] });

    if (!isPayloadWithData(getPayload)) return payload;

    const { data } = getPayload;
    const result = Result.from(() => schema.parse(data));

    if (result.isErr()) {
      payload.errors.push(
        this.error({ identifier: SchemaMiddleware.Identifiers.InvalidData, method: Method.Update, context: { shapeshiftError: result.unwrapErr() } })
      );
    }

    return payload;
  }

  protected fetchVersion() {
    return this.version;
  }
}

export namespace SchemaMiddleware {
  export interface ContextData<StoredValue = unknown> extends JoshMiddleware.Context {
    /**
     * The schema used to parse and validate data.
     * @since 1.0.0
     */
    schema: BaseValidator<StoredValue>;
  }

  export enum Identifiers {
    InvalidData = 'invalidData',

    InvalidValue = 'invalidValue'
  }
}
