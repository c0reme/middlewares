import { MapProvider } from '@joshdb/map';
import { JoshMiddlewareStore, MathOperator, Method, Payload } from '@joshdb/provider';
import { TransformMiddleware } from '../../src';

describe('TransformMiddleware', () => {
  describe('is a class', () => {
    test(`GIVEN typeof TransformMiddleware THEN returns function`, () => {
      expect(typeof TransformMiddleware).toBe('function');
    });

    test('GIVEN typeof ...prototype THEN returns object', () => {
      expect(typeof TransformMiddleware.prototype).toBe('object');
    });
  });

  describe('can transform provider data', () => {
    // @ts-expect-error 2322
    const store = new JoshMiddlewareStore({ provider: new MapProvider() });
    const transform = new TransformMiddleware<unknown>({
      before(data: any) {
        if (typeof data === 'number') return data.toString();
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') {
          for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'number') data[key] = value.toString();
          }
        }

        return data;
      },
      after(data: any) {
        if (typeof data === 'string') return Number(data);
        if (Array.isArray(data)) return data;
        if (typeof data === 'object') {
          for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') data[key] = Number(value);
          }
        }

        return data;
      }
    });

    beforeAll(async () => {
      // @ts-expect-error 2345
      await transform.init(store);
    });

    beforeEach(async () => {
      await store.provider[Method.Clear]({ method: Method.Clear, errors: [] });
    });

    describe(Method.Dec, () => {
      test('GIVEN provider w/ data THEN middleware can decrease by 1', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '2' });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe('2');

        const payload = await transform[Method.Dec]({ method: Method.Dec, errors: [], key: 'key', path: [] });
        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Dec);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('1');
      });
    });

    describe(Method.Ensure, () => {
      test('GIVEN middleware w/ data THEN manipulate data', async () => {
        const payload = await transform[Method.Ensure]({ method: Method.Ensure, errors: [], key: 'key', defaultValue: { a: 1, b: '2', c: [1] } });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Ensure);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({ a: '1', b: '2', c: [1] });

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toStrictEqual({ a: '1', b: '2', c: [1] });
      });

      test('GIVEN provider w/o data THEN middleware can normalise data', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: {} });

        const payload = await transform[Method.Ensure]({ method: Method.Ensure, errors: [], key: 'key', defaultValue: { a: 1, b: '2', c: [1] } });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Ensure);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({});
      });
    });

    describe(Method.Entries, () => {
      test('GIVEN provider w/ data THEN normalise a key', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: { a: 1, b: '2', c: [1] } });

        const payload = await transform[Method.Entries]({ method: Method.Entries, errors: [] });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Entries);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({ key: { a: 1, b: 2, c: [1] } });
      });

      test('GIVEN provider w/o data THEN middleware can normalise data', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: {} });

        const payload = await transform[Method.Entries]({ method: Method.Entries, errors: [] });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Entries);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({ key: {} });
      });

      test('GIVEN provider w/ data THEN middleware can normalise data', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Entries]({ method: Method.Entries, errors: [] });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Entries);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({ key: 1, anotherKey: { a: 1, b: 2, c: [1] } });
      });
    });

    describe(Method.Every, () => {
      test('GIVEN middleware w/ data THEN check every by value', async () => {
        await transform[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: ['path1'], value: 1 }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Every]({
          method: Method.Every,
          errors: [],
          type: Payload.Type.Value,
          path: [],
          value: '1'
        });

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Every);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toBe(true);
      });

      test('GIVEN middleware w/ data THEN check every by hook', async () => {
        await transform[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: ['path1'], value: 1 }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Every]({
          method: Method.Every,
          errors: [],
          type: Payload.Type.Hook,
          hook: (value: any) => value === '1'
        });

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Every);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toBe(true);
      });
    });

    describe(Method.Filter, () => {
      test('GIVEN provider w/ data THEN normalise data by value', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: ['path'], value: '1' },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: ['path'] });

        expect(getBefore.data).toBe('1');

        const payload = await transform[Method.Filter]({
          method: Method.Filter,
          errors: [],
          type: Payload.Type.Value,
          path: ['path'],
          value: 1
        });

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Filter);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({ key: { path: 1 } });
      });

      test('GIVEN provider w/ data THEN normalise data by hook', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: '1' },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Filter]({
          method: Method.Filter,
          errors: [],
          type: Payload.Type.Hook,
          hook: (value) => typeof value === 'object'
        });

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Filter);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual({ anotherKey: { a: 1, b: 2, c: [1] } });
      });
    });

    describe(Method.Find, () => {
      test('GIVEN provider w/ data THEN normalise data by value', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: ['path'], value: '1' },
            { key: 'anotherKey', path: [], value: { a: '1', b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Find]({ method: Method.Find, errors: [], type: Payload.Type.Value, path: ['path'], value: 1 });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Find);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual(['1', { path: 1 }]);
      });

      test('GIVEN provider w/ data THEN normalise data by value w/o path', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: '1' },
            { key: 'anotherKey', path: [], value: { a: '1', b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Find]({ method: Method.Find, errors: [], type: Payload.Type.Value, path: [], value: 1 });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Find);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        expect(data).toStrictEqual([null, null]);
      });

      test('GIVEN provider w/ data THEN normalise data by hook', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: '1' },
            { key: 'anotherKey', path: [], value: { a: '1', b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Find]({
          method: Method.Find,
          errors: [],
          type: Payload.Type.Hook,
          hook: (value: any) => value === '1'
        });

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Find);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual(['1', 1]);
      });
    });

    describe(Method.Get, () => {
      test(`GIVEN provider w/ data THEN middleware can normalise data`, async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '1' });

        const payload = await transform[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });
        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Get);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(payload.data).toBe(1);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('1');
      });
    });

    describe(Method.GetMany, () => {
      test('GIVEN provider w/ data THEN middleware can normalise data', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: '1', b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const payload = await transform[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.GetMany);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        expect(Object.entries(data!)).toContainEqual(['key', 1]);
        expect(Object.entries(data!)).toContainEqual(['anotherKey', { a: 1, b: 2, c: [1] }]);
      });
    });

    describe(Method.Inc, () => {
      test('GIVEN provider w/ data THEN middleware can increase by 1', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '1' });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe('1');

        const payload = await transform[Method.Inc]({ method: Method.Inc, errors: [], key: 'key', path: [] });
        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Inc);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('2');
      });
    });

    describe(Method.Map, () => {
      test(`GIVEN provider w/ data THEN middleware manipulates using hook function`, async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Hook, hook: (val) => val });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Map);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        expect(data).toStrictEqual([1, { a: 1, b: 2, c: [1] }]);
      });

      test(`GIVEN provider w/ data THEN middleware manipulates using an empty path`, async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Path, path: [] });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Map);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        expect(data).toStrictEqual([1, { a: 1, b: 2, c: [1] }]);
      });

      test(`GIVEN provider w/ data THEN middleware manipulates using a path`, async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.Map]({ method: Method.Map, errors: [], type: Payload.Type.Path, path: ['b'] });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Map);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        expect(data).toStrictEqual([2]);
      });
    });

    describe(Method.Math, () => {
      test('GIVEN provider w/ data THEN middleware can add 3', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '1' });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe('1');

        const payload = await transform[Method.Math]({
          method: Method.Math,
          errors: [],
          key: 'key',
          path: [],
          operator: MathOperator.Addition,
          operand: 3
        });

        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Math);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('4');
      });

      test('GIVEN provider w/ data THEN middleware can subtract 3', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '4' });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe('4');

        const payload = await transform[Method.Math]({
          method: Method.Math,
          errors: [],
          key: 'key',
          path: [],
          operator: MathOperator.Subtraction,
          operand: 3
        });

        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Math);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('1');
      });

      test('GIVEN provider w/ data THEN middleware can multiply by 3', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '1' });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe('1');

        const payload = await transform[Method.Math]({
          method: Method.Math,
          errors: [],
          key: 'key',
          path: [],
          operator: MathOperator.Multiplication,
          operand: 3
        });

        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Math);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('3');
      });

      test('GIVEN provider w/ data THEN middleware can divide by 3', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: '3' });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe('3');

        const payload = await transform[Method.Math]({
          method: Method.Math,
          errors: [],
          key: 'key',
          path: [],
          operator: MathOperator.Division,
          operand: 3
        });

        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Math);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('1');
      });
    });

    describe(Method.Push, () => {
      test('GIVEN provider w/ data THEN middleware can push to array', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: ['1', '2', '3'] });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toStrictEqual(['1', '2', '3']);

        const payload = await transform[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: [], value: '4' });
        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Push);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toStrictEqual(['1', '2', '3', '4']);
      });

      test('GIVEN provider w/ data THEN middleware can push to array in object', async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: { a: '1', b: '2', c: ['3'] } });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toStrictEqual({ a: '1', b: '2', c: ['3'] });

        const payload = await transform[Method.Push]({ method: Method.Push, errors: [], key: 'key', path: ['c'], value: '4' });
        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Push);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toStrictEqual({ a: '1', b: '2', c: ['3', '4'] });
      });
    });

    describe(Method.Random, () => {
      test('GIVEN middleware w/ data THEN middleware normalises a random value', async () => {
        await transform[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: '1' },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } },
            { key: 'yetAnotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Random]({ method: Method.Random, errors: [], duplicates: false, count: 1 });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Random);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toEqual(expect.any(Array));
      });

      test('GIVEN middleware w/ data THEN middleware normalises random values w/ duplicates', async () => {
        await transform[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: '1' },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } },
            { key: 'yetAnotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: false
        });

        const payload = await transform[Method.Random]({ method: Method.Random, errors: [], duplicates: true, count: 3 });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Random);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toEqual(expect.any(Array));
        expect(data!.length).toBe(3);
      });
    });

    describe(Method.Set, () => {
      test(`GIVEN middleware w/ data THEN provider can access manipulated data`, async () => {
        const payload = await transform[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 1 });
        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Set);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('1');
      });

      test(`GIVEN middleware w/ data THEN manipulate and normalise data`, async () => {
        await transform[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 1 });

        const payload = await transform[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });
        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Get);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toBe(1);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('1');
      });
    });

    describe(Method.SetMany, () => {
      test(`GIVEN provider w/ data THEN middleware can manipulate data`, async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.SetMany);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getManyAfter = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyAfter.data!)).toContainEqual(['key', '1']);
        expect(Object.entries(getManyAfter.data!)).toContainEqual(['anotherKey', { a: '1', b: '2', c: [1] }]);
      });
    });

    describe(Method.Some, () => {
      test(`GIVEN provider w/ data THEN middleware manipulates by value`, async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.Some]({
          method: Method.Some,
          errors: [],
          type: Payload.Type.Value,
          path: ['b'],
          value: 2
        });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Some);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual(true);
      });

      test(`GIVEN provider w/ data THEN middleware manipulates by hook`, async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.Some]({
          method: Method.Some,
          errors: [],
          type: Payload.Type.Hook,
          hook: (value: any) => value.b === 2
        });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Some);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);
        expect(data).toStrictEqual(true);
      });
    });

    describe(Method.Update, () => {
      test(`GIVEN provider w/ data THEN middleware can manipulate data`, async () => {
        await store.provider[Method.Set]({ method: Method.Set, errors: [], key: 'key', path: [], value: 1 });

        const getBefore = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getBefore.data).toBe(1);

        const payload = await transform[Method.Update]({
          method: Method.Update,
          errors: [],
          key: 'key',
          hook: (data) => {
            return (data as number) * 5;
          }
        });

        const { method, trigger, errors } = payload;

        expect(method).toBe(Method.Update);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        const getAfter = await store.provider[Method.Get]({ method: Method.Get, errors: [], key: 'key', path: [] });

        expect(getAfter.data).toBe('5');
      });
    });

    describe(Method.Values, () => {
      test('GIVEN provider w/ data THEN middleware manipulates', async () => {
        await store.provider[Method.SetMany]({
          method: Method.SetMany,
          errors: [],
          entries: [
            { key: 'key', path: [], value: 1 },
            { key: 'anotherKey', path: [], value: { a: 1, b: '2', c: [1] } }
          ],
          overwrite: true
        });

        const getManyBefore = await store.provider[Method.GetMany]({ method: Method.GetMany, errors: [], keys: ['key', 'anotherKey'] });

        expect(Object.entries(getManyBefore.data!)).toContainEqual(['key', 1]);
        expect(Object.entries(getManyBefore.data!)).toContainEqual(['anotherKey', { a: 1, b: '2', c: [1] }]);

        const payload = await transform[Method.Values]({ method: Method.Values, errors: [] });

        expect(typeof payload).toBe('object');

        const { method, trigger, errors, data } = payload;

        expect(method).toBe(Method.Values);
        expect(trigger).toBeUndefined();
        expect(errors).toStrictEqual([]);

        expect(data).toStrictEqual([1, { a: 1, b: 2, c: [1] }]);
      });
    });
  });
});
