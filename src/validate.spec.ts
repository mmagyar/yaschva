/* eslint-disable dot-notation */

import { validate, loadJson } from './validate.js'
import { Validation } from './validationTypes.js'
import fs from 'fs'
import { inspect } from 'util'
inspect.defaultOptions.depth = null

const file = fs.promises.readFile
describe('validate', () => {
  let loaded:Validation
  const schemaSchema = async () => {
    if (!loaded) { loaded = loadJson(await file('./selfSchema.json', 'utf8')) }
    return loaded
  }
  beforeAll(async () => schemaSchema())
  afterEach(() => {
    // eslint-disable-next-line no-proto
    delete ({} as any).__proto__.b
  })
  const validSchema = (schema:Validation):Validation => {
    const validated = validate(loaded, schema)
    expect(validated).toHaveProperty('result', 'pass')
    return schema
  }

  const invalidSchema = (schema:any):Validation => {
    const validated = validate(loaded, schema)
    if (validated.result !== 'fail') {
      throw new Error(JSON.stringify(validated, null, 2))
    }
    return schema
  }

  const valid = (schema:Validation, data:any) => {
    const dataValid = validate(validSchema(schema), data)
    if (dataValid.result !== 'pass') {
      throw new Error(JSON.stringify(dataValid, null, 2))
    }
  }

  const invalid = (schema:Validation, data:any) => {
    const dataValid = validate(validSchema(schema), data)
    if (dataValid.result === 'pass') console.log(dataValid.output)
    expect(dataValid).toHaveProperty('result', 'fail')
  }

  it('Shows example schema working', async () => {
    const example = loadJson(await file('./examples/example1.json', 'utf8'))
    validSchema(example)
    const data = {
      myString: '35p5Rx',
      myOptionalString: 'opts',
      myObject: {
        myNumberInsideAnObject: -1064355751952420,
        myDetailedNumberInsideAnObject: 7.547970286391079
      },
      myArrayOfNumbers: [6021837145779515, -3586724423310628, 7654360694223995, -4591855572376372],
      myEnum: 'enum2',
      myNumberRange: 5,
      myKeyValuePairs: {
        h5mRyKCL: 'fq3aXU', wff99z2e: '4D0Ptj', h3VcecUx: 'vmKmRU', Ox3CN4Iq: '2FWzGw'
      },
      myMultiType: -8508087912141643,
      myNull: null,
      myRegex: 'work',
      myAddress: {
        name: 'Homer Simpson',
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        country: 'USA'
      }
    }
    expect(validate(example, data)).toHaveProperty('result', 'pass')
    expect(validate(example, { })).toHaveProperty('result', 'fail')

    expect(validate(example, { })).toEqual({
      result: 'fail',
      output: {
        myString: { error: 'Value is not a string', value: undefined },
        myOptionalString: null,
        myObject: { error: 'Value is not an Object', value: undefined },
        myArrayOfNumbers: { error: 'Value is not an Array', value: undefined },
        myEnum: { error: 'Value is not a string', value: undefined },
        myKeyValuePairs: { error: 'Value is not a Map (freeform Object)', value: undefined },
        myMultiType: {
          error: 'Did not match any from the listed types',
          value: undefined,
          output: [
            { error: 'Value is not a string', value: undefined },
            { error: 'Value is not a number', value: undefined }
          ]
        },
        myNull: { error: 'Value is not null', value: undefined },
        myNumberRange: { error: 'Value is not a number', value: undefined },
        myRegex: { error: 'Value is not a string', value: undefined },
        myAddress: { error: 'Value is not an Object', value: undefined }
      }
    })
  })

  it('Can validate itself with itself', async () => {
    const example = loadJson(await file('./selfSchema.json', 'utf8'))
    const validated = validate(example, example)
    expect(validated).toHaveProperty('result', 'pass')
  })

  it('Passes validation for correct simple values', () => {
    valid('string', 'hello')
    valid('integer', 123)
    valid('number', 123.3)
    valid('boolean', true)
    valid('?', undefined)
    valid('null', null)
    valid('any', 233)
    valid({ $type: 'string' }, 'desert')
  })

  it('Fails validation for incorrect simple values', async () => {
    invalid('string', 234)
    invalid('integer', 123.4)
    invalid('integer', '123')
    invalid('number', '123.4')
    invalid('boolean', 'true')
    invalid('?', 'yes')
    invalid('null', 'no')
    invalid('null', undefined)

    // Fails for non safe integer above 2^53
    invalid('integer', 12332323423445323)

    // any does not fail for any data type
  })

  it('Passes objects with correct values', () => {
    valid({}, {})
    valid({ myNumber: 'number' }, { myNumber: 12.3 })
    valid({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
      { num: 12.3, int: 12, str: 'Hello', bool: false })
  })

  it('Fails objects with missing properties', () => {
    invalid({ myNumber: 'number' }, {})
    invalid({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
      { num: 3 })
  })

  it('Fails objects with incorrect values', () => {
    invalid({}, null)
    invalid({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
      JSON.stringify({ num: 12.3, int: 12, str: 'Hello', bool: false }))
  })

  it('Can handle multiple type for a single value', () => {
    valid(['integer', 'string'], 'hello')
    valid(['integer', 'string'], 123)
    invalid(['integer', 'string'], {})
  })

  it('Handles optional values via multi-types', () => {
    valid(['integer', 'string', '?'], 'hello')
    valid(['integer', 'string', '?'], 123)
    valid(['integer', 'string', '?'], undefined)
    invalid(['integer', 'string', '?'], {})

    const type: Validation = { myValue: ['integer', 'string', '?'] }
    valid(type, { myValue: 1233232342344532 })
    valid(type, { myValue: 'abc' })
    valid(type, {})
    invalid(type, undefined)
  })

  it('Handles arrays with special syntax', () => {
    valid({ $array: 'string' }, ['hello'])
    valid({ $array: 'string' }, ['hello', 'abc'])
    valid({ $array: 'string' }, [])
    invalid({ $array: 'string' }, [2])
    invalid({ $array: 'string' }, 'hello')
    valid(['integer', { $array: ['string'] }], ['true', 'this'])
    invalid(['integer', { $array: ['string'] }], [1])
  })

  it('Handles enums with special syntax', () => {
    const type: Validation = { $enum: ['ts', 'typescript'] }
    valid(type, 'ts')
    valid(type, 'typescript')
    invalid(type, 'javascript')
    invalid(type, ['ts'])
    invalid(type, { $enum: 'ts' })
  })

  it('Provides useful error description', () => {
    const type = validSchema({
      num: 'number',
      int: 'integer',
      str: 'string',
      bool: 'boolean',
      obj: { member: 'boolean', memberId: ['string', '?'] }
    })
    const result = validate(type, { num: 'abc' })

    expect(result).toHaveProperty('result', 'fail')
    expect(result.output).toStrictEqual({
      num: { error: 'Value is not a number', value: 'abc' },
      int: { error: 'Value is not an integer ', value: undefined },
      str: { error: 'Value is not a string', value: undefined },
      bool: { error: 'Value is not a boolean', value: undefined },
      obj: { error: 'Value is not an Object', value: undefined }
    })

    const result2 = validate(type, { int: 123.3, str: [], bool: 'true', obj: {} })

    expect(result2).toHaveProperty('result', 'fail')
    expect(result2.output).toStrictEqual({
      num: { error: 'Value is not a number', value: undefined },
      int: { error: 'Value is not an integer ', value: 123.3 },
      str: { error: 'Value is not a string', value: [] },
      bool: { error: 'Value is not a boolean', value: 'true' },
      obj: {
        member: { error: 'Value is not a boolean', value: undefined },
        memberId: null
      }
    })
  })

  it('Uses null to signal that there is no error for a given property', () => {
    const type = validSchema({
      obj: { member: 'boolean', memberId: ['string', '?'], nested: { inside: 'string' } }
    })
    const result = validate(type, { obj: { member: false, nested: { inside: 'hello' } } })

    expect(result).toHaveProperty('result', 'pass')
    expect(result.output).toStrictEqual({
      obj: {
        member: null,
        nested: { inside: null },
        memberId: null
      }
    })
  })

  it('Rejects objects with additional keys', () => {
    invalid({ myValue: 'integer' }, { myValue: 2, ourValue: 3 })
  })

  it('Throws on type definition with empty array of types', () => {
    const malformedSchema = invalidSchema({ myValue: [] })
    expect(() => validate(malformedSchema, { myValue: 2 })).toThrowError()
  })

  it('Throws on unknown type definition', () => {
    expect(() => validate(invalidSchema({ myValue: 'bigFlout' }), { myValue: 2 }))
      .toThrowError('Unknown validator:"bigFlout"')

    expect(() => validate(invalidSchema({ $whatever: 'bigFloat' }), { myValue: 2 }))
      .toThrowError('Unknown validator:{"$whatever":"bigFloat"}')

    expect(() => validate(invalidSchema(undefined), {}))
      .toThrowError('Type for validation cannot be undefined')
  })

  it('Reserves keys starting with $ (dollar sign) for type data', () => {
    expect(() => validate(invalidSchema({ $whatever: 'string' }),
      { $whatever: 2 })).toThrowError()
  })

  it('Can validate string length', () => {
    const schema = validSchema({ $string: { minLength: 4, maxLength: 6 } })
    expect(validate(schema, 'abc')).toEqual({
      result: 'fail',
      output: {
        error: 'String is shorter than the required minimum length', value: 'abc'
      }
    })

    expect(validate(schema, 'Lorem ipsum')).toEqual({
      result: 'fail',
      output: {
        error: 'String is longer than the required maximum length', value: 'Lorem ipsum'
      }
    })

    valid(schema, 'hello')
  })

  it('Can validate string by regex', () => {
    const schema = validSchema({ $string: { regex: 'hello \\w+' } })
    expect(validate(schema, 'abc')).toEqual({
      result: 'fail',
      output: {
        error: 'String did not match required regex', value: 'abc'
      }
    })

    valid(schema, 'hello world')
  })

  it('Can enforce maximum / minimum number', () => {
    const schema = validSchema({ $number: { min: 1, max: 66 } })

    expect(validate(schema, 0)).toEqual({
      result: 'fail',
      output: { error: 'Value is smaller than the required minimum', value: 0 }
    })

    expect(validate(schema, 67)).toEqual({
      result: 'fail',
      output: { error: 'Value is bigger than the required maximum', value: 67 }
    })

    expect(validate(schema, 44.5)).toHaveProperty('result', 'pass')
  })

  it('Can enforce maximum / minimum number as integers', () => {
    const schema = validSchema({ $number: { min: 1, max: 66, integer: true } })

    expect(validate(schema, 0)).toHaveProperty('result', 'fail')

    expect(validate(schema, 67)).toHaveProperty('result', 'fail')

    expect(validate(schema, 44.5)).toHaveProperty('result', 'fail')
    expect(validate(schema, 44)).toHaveProperty('result', 'pass')
  })

  it('Can validate key value pairs (map)', () => {
    const schema: Validation = { $map: ['number'] }
    valid(schema, { x: 3, y: 4, z: 99 })
    invalid(schema, { x: 3, y: 4, z: '99' })
    invalid(schema, { x: 3, y: 'a string', z: 34 })
  })

  it('Key value pair keys can be regex validated', () => {
    const schema: Validation = { $map: ['number'], key: { $string: { regex: '^ab[a-z]' } } }
    valid(schema, { abx: 3, aby: 4, abz: 99 })
    invalid(schema, { x: 3, y: 4, z: 99 })
    invalid(schema, { abx: 3, aby: 'a string', abz: 34 })
  })

  it('Protects against global object prototype injection', () => {
    const schema = validSchema({ a: 'number', b: ['string', '?'] })
    const input: any = { a: 4 }
    // eslint-disable-next-line no-proto
    input.__proto__.b = 99
    const result = validate(schema, input)
    expect(result).toHaveProperty('output.a', null)
    expect(result).toHaveProperty('output.b.error',
      'Did not match any from the listed types')
  })

  it('Protects against prototype injection on class', () => {
    const schema = validSchema({ a: 'number', b: ['string', '?'] })
    // eslint-disable-next-line no-useless-constructor
    class Test1 { constructor (public readonly a: number) {} }
    const input: any = new Test1(4)
    // eslint-disable-next-line no-proto
    input.__proto__.b = 3
    const result = validate(schema, input)
    expect(result).toHaveProperty('output.a', null)
    expect(result).toHaveProperty('output.b.error',
      'Did not match any from the listed types')
  })

  it.skip('Protects against prototype injection from json', () => {
    const schema = validSchema({ a: 'number', b: ['string', '?'] })
    const input: any = JSON.parse('{ "a": 5, "__proto__": {"b" : 3} }')
    const input2 = { ...input }
    const result = validate(schema, input2)
    expect(input2.b).toEqual(3)
    expect(result).toHaveProperty('output.a', null)
    expect(result).toHaveProperty('output.b.error',
      'Did not match any from the listed types')
  })

  it.skip('Can use type definitions', () => {
    const schema = validSchema({
      $types: { $range: { $number: { min: 1, max: 99 } } },
      a: 'number',
      b: '$range'
    })

    valid(schema, { a: 2, b: 43 })
    invalid(schema, { a: 2, b: 101 })
    invalid(schema, { a: 2, b: 0 })
  })

  it('Type definitions can reference each other.', () => {
    const schema: Validation = {
      $types: {
        $myObject: { itsRange: '$range', name: 'string' },
        $range: { $number: { min: 1, max: 99 } }
      },
      a: '$myObject',
      b: '$range'
    }

    valid(schema, { a: { name: 'abc', itsRange: 22 }, b: 43 })
    invalid(schema, { a: { name: 'abc', itsRange: 101 }, b: 43 })
    invalid(schema, { a: { name: 'abc', itsRange: 22 }, b: 0 })
    invalid(schema, { a: 2, b: 0 })
  })

  it('$ sign can be escaped in the schema and used for data key', () => {
    const validated = validate(
      validSchema({ myNumber: 'number', '\\$escapedDollar': 'string' }),
      { myNumber: 12.3, $escapedDollar: 'value' })
    expect(validated).toHaveProperty('result', 'pass')
    expect(validated.output).toHaveProperty('$escapedDollar', null)

    const validated2 = validate(
      validSchema({ myNumber: 'number', '\\$escapedDollar': 'string' }),
      { myNumber: 12.3, $escapedDollar: 234 })
    expect(validated2).toHaveProperty('result', 'fail')
    expect(validated2.output).toHaveProperty('$escapedDollar',
      { error: 'Value is not a string', value: 234 })
  })

  it('Root can be a meta type', () => {
    valid({ $type: { $array: 'string' } }, ['a', 'b', 'c'])
  })

  it('Root can be a custom type via a meta type', () => {
    const validated = validate({
      $types: { $customType: { value: 'string', nodes: { $array: '$customType' } } },
      $type: '$customType'
    }, { value: 'abc', nodes: [{ value: 'xyz', nodes: [] }] })
    expect(validated).toHaveProperty('result', 'pass')
  })

  it('Can validated recursive data structure', () => {
    const schema :Validation = {
      $types: { $tree: { value: 'string', left: ['?', '$tree'], right: ['?', '$tree'] } },
      root: '$tree'
    }

    valid(schema, {
      root: {
        value: 'Dcn819x2PCmJV',
        left: {
          value: 'mEiX0hq435IXt',
          left: { value: 'coGEB1xXQmsRS' },
          right: { value: '6lBoBa' }
        },
        right: {
          value: 'mV9j2',
          left: { value: 'iL42zyiOv' },
          right: { value: 'Bx6FbX' }
        }
      }
    })
  })

  it('Can validate to multiple objects with $and', () => {
    const schema:Validation = {
      $and: [
        { valueA: 'string' },
        { valueB: 'number' },
        { $type: { otherValue: 'number' } }]
    }
    valid(schema, { valueA: 'someString', valueB: 32, otherValue: 9 })
  })

  it('When and $and is specified input must satisfy both objects', () => {
    invalid({ $and: [{ valueA: 'string' }, { valueB: 'number' }] },
      { valueA: 'someString' })
  })

  it('$and only accepts object', () => {
    const schema:Validation = { $and: [{ valueA: 'string' }, 'string'] }
    invalid(schema, { valueA: 'someString' })
  })

  it('Can validate to multiple custom types with $and', () => {
    const schema:Validation = {
      $types: {
        $myObject: { value: 'string' },
        $otherObject: { num: 'number' },
        $myMetaObject: { $type: { value2: 'string' } }
      },
      $and: [{ valueA: 'string' }, '$myObject', '$myMetaObject', { $type: '$otherObject' }]
    }
    valid(schema, {
      valueA: 'someString',
      value: 'value',
      value2: 'value2',
      num: 88
    })
  })

  it('Will reject arrays that are too short', () => {
    invalid({ $array: 'string', minLength: 3 }, ['abc', 'efg'])
  })

  it('Will reject arrays that are too long', () => {
    invalid({ $array: 'string', maxLength: 3 }, ['abc', 'efg', 'some', 'value'])
  })

  it('Will accept arrays that has a length between the constraints', () => {
    valid({ $array: 'string', minLength: 1, maxLength: 3 }, ['some', 'value'])
  })

  it('Will reject maps with too few properties', () => {
    invalid({ $map: 'string', minLength: 3 }, { a: 'abc', b: 'efg' })
  })

  it('Will reject maps with too many properties', () => {
    invalid({ $map: 'string', maxLength: 3 }, { a: 'abc', e: 'efg', c: 'some', d: 'value' })
  })

  it('Will accept maps that has a property count between constraints', () => {
    valid({ $map: 'string', minLength: 1, maxLength: 3 }, { a: 'some', x: 'value' })
  })

  it('Can specify types for some keys in map', () => {
    valid({ $map: 'string', keySpecificType: { a: 'number' } }, { a: 12, x: 'value' })

    invalid({ $map: 'string', keySpecificType: { a: 'number' } }, { a: 'str', x: 'value' })
  })

  it('Map specified keys are mandatory', () => {
    invalid({ $map: 'string', keySpecificType: { a: 'number' } }, { x: 'value' })
  })
})
