/* eslint-disable dot-notation */
import { validate, loadJson } from './validate'
import { Validation } from './validationTypes'

describe('validate', () => {
  it('shows example schema working', async () => {
    const example = await loadJson(await import('../examples/example1.json'))
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
        myKeyValuePairs: { error: 'Value is not an Object', value: undefined },
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

  it('passes validation for correct simple values', () => {
    expect(validate('string', 'hello')).toHaveProperty('result', 'pass')
    expect(validate('integer', 123)).toHaveProperty('result', 'pass')
    expect(validate('number', 123.3)).toHaveProperty('result', 'pass')
    expect(validate('boolean', true)).toHaveProperty('result', 'pass')
    expect(validate('?', undefined)).toHaveProperty('result', 'pass')
    expect(validate('null', null)).toHaveProperty('result', 'pass')
    expect(validate('any', 233)).toHaveProperty('result', 'pass')
    expect(validate({ $type: 'string' }, 'desert')).toHaveProperty('result', 'pass')
  })

  it('fails validation for incorrect simple values', () => {
    expect(validate('string', 234)).toHaveProperty('result', 'fail')
    expect(validate('integer', 123.4)).toHaveProperty('result', 'fail')
    expect(validate('integer', '123')).toHaveProperty('result', 'fail')
    expect(validate('number', '123.4')).toHaveProperty('result', 'fail')
    expect(validate('boolean', 'true')).toHaveProperty('result', 'fail')
    expect(validate('?', 'yes')).toHaveProperty('result', 'fail')
    expect(validate('null', 'no')).toHaveProperty('result', 'fail')
    expect(validate('null', undefined)).toHaveProperty('result', 'fail')

    // Fails for non safe integer above 2^53
    expect(validate('integer', 12332323423445323)).toHaveProperty('result', 'fail')

    // any does not fail for any data type
  })

  it('passes objects with correct values', () => {
    expect(validate({}, {})).toHaveProperty('result', 'pass')
    expect(validate({ myNumber: 'number' }, { myNumber: 12.3 })).toHaveProperty('result', 'pass')
    expect(validate(
      { num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
      { num: 12.3, int: 12, str: 'Hello', bool: false }
    )).toHaveProperty('result', 'pass')
  })

  it('fails objects with missing properties', () => {
    expect(validate({ myNumber: 'number' }, {})).toHaveProperty('result', 'fail')
    expect(validate({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
      { num: 3 })).toHaveProperty('result', 'fail')
  })

  it('fails objects with incorrect values', () => {
    expect(validate({}, null)).toHaveProperty('result', 'fail')
    expect(validate({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
      JSON.stringify({ num: 12.3, int: 12, str: 'Hello', bool: false })))
      .toHaveProperty('result', 'fail')
  })

  it('can handle multiple type for a single value', () => {
    expect(validate(['integer', 'string'], 'hello')).toHaveProperty('result', 'pass')
    expect(validate(['integer', 'string'], 123)).toHaveProperty('result', 'pass')
    expect(validate(['integer', 'string'], {})).toHaveProperty('result', 'fail')
  })

  it('handles optional values via multi-types', () => {
    expect(validate(['integer', 'string', '?'], 'hello')).toHaveProperty('result', 'pass')
    expect(validate(['integer', 'string', '?'], 123)).toHaveProperty('result', 'pass')
    expect(validate(['integer', 'string', '?'], undefined)).toHaveProperty('result', 'pass')
    expect(validate(['integer', 'string', '?'], {})).toHaveProperty('result', 'fail')

    const type: Validation = { myValue: ['integer', 'string', '?'] }
    expect(validate(type, { myValue: 1233232342344532 })).toHaveProperty('result', 'pass')
    expect(validate(type, { myValue: 'abc' })).toHaveProperty('result', 'pass')
    expect(validate(type, {})).toHaveProperty('result', 'pass')
    expect(validate(type, undefined)).toHaveProperty('result', 'fail')
  })

  it('handles arrays with special syntax', () => {
    expect(validate({ $array: 'string' }, ['hello'])).toHaveProperty('result', 'pass')
    expect(validate({ $array: 'string' }, ['hello', 'abc'])).toHaveProperty('result', 'pass')
    expect(validate({ $array: 'string' }, [2])).toHaveProperty('result', 'fail')
    expect(validate({ $array: 'string' }, 'hello')).toHaveProperty('result', 'fail')
    expect(validate(['integer', { $array: ['string'] }], ['true', 'this']))
      .toHaveProperty('result', 'pass')
    expect(validate(['integer', { $array: ['string'] }], [1])).toHaveProperty('result', 'fail')
  })

  it('handles enums with special syntax', () => {
    const type: Validation = { $enum: ['ts', 'typescript'] }
    expect(validate(type, 'ts')).toHaveProperty('result', 'pass')
    expect(validate(type, 'typescript')).toHaveProperty('result', 'pass')
    expect(validate(type, 'javascript')).toHaveProperty('result', 'fail')
    expect(validate(type, ['ts'])).toHaveProperty('result', 'fail')
    expect(validate(type, { $enum: 'ts' })).toHaveProperty('result', 'fail')
  })

  it('provides useful error description', () => {
    const type: Validation = {
      num: 'number',
      int: 'integer',
      str: 'string',
      bool: 'boolean',
      obj: { member: 'boolean', memberId: ['string', '?'] }
    }
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

  it('uses null to signal that there is no error for a given property', () => {
    const type: Validation =
      { obj: { member: 'boolean', memberId: ['string', '?'], nested: { inside: 'string' } } }
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

  it('rejects objects with additional keys', () => {
    expect(validate({ myValue: 'integer' }, { myValue: 2, ourValue: 3 }))
      .toHaveProperty('result', 'fail')
  })

  it('throws on type definition with empty array of types', () => {
    expect(() => validate({ myValue: [] }, { myValue: 2 })).toThrowError()
  })

  it('throws on unknown type definition', () => {
    expect(() => validate({ myValue: 'bigFlout' } as any, { myValue: 2 }))
      .toThrowError('Unknown validator:"bigFlout"')

    expect(() => validate({ $whatever: 'bigFloat' } as any, { myValue: 2 }))
      .toThrowError('Unknown validator:{"$whatever":"bigFloat"}')

    expect(() => validate(undefined as any, {}))
      .toThrowError('Type for validation cannot be undefined')
  })

  it('reserves keys starting with $ (dollar sign) for type data', () => {
    expect(() => validate({ $whatever: 'string' }, { $whatever: 2 })).toThrowError()
  })

  it('can validate string length', () => {
    const schema: Validation = { $string: { minLength: 4, maxLength: 6 } }
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

    expect(validate(schema, 'hello')).toHaveProperty('result', 'pass')
  })

  it('can validate string by regex', () => {
    const schema: Validation = { $string: { regex: 'hello \\w+' } }
    expect(validate(schema, 'abc')).toEqual({
      result: 'fail',
      output: {
        error: 'String did not match required regex', value: 'abc'
      }
    })

    expect(validate(schema, 'hello world')).toHaveProperty('result', 'pass')
  })

  it('can enforce maximum / minimum number', () => {
    const schema: Validation = { $number: { min: 1, max: 66 } }

    expect(validate(schema, 0)).toEqual({
      result: 'fail',
      output: {
        error: 'Value is smaller than the required minimum', value: 0
      }
    })

    expect(validate(schema, 67)).toEqual({
      result: 'fail',
      output: {
        error: 'Value is bigger than the required maximum', value: 67
      }
    })

    expect(validate(schema, 44)).toHaveProperty('result', 'pass')
  })

  it('can validate key value pairs (map)', () => {
    const schema: Validation = { $map: ['number'] }
    expect(validate(schema, { x: 3, y: 4, z: 99 })).toHaveProperty('result', 'pass')
    expect(validate(schema, { x: 3, y: 4, z: '99' })).toHaveProperty('result', 'fail')
    expect(validate(schema, { x: 3, y: 'a string', z: 34 })).toHaveProperty('result', 'fail')
  })

  it('protects against prototype injection', () => {
    const schema: Validation = { a: 'number', b: ['string', '?'] }
    const input: any = { a: 4 }
    // eslint-disable-next-line no-proto
    input.__proto__.b = 3
    const result = validate(schema, input)
    expect(result).toHaveProperty('output.a', null)
    expect(result).toHaveProperty('output.b.error', 'Did not match any from the listed types')
  })

  it('protects against prototype injection from json', () => {
    const schema: Validation = { a: 'number', b: ['string', '?'] }
    const input: any = JSON.parse('{ "a": 5, "__proto__": {"b" : 3} }')
    const input2 = { ...input }
    const result = validate(schema, input2)
    expect(input2.b).toEqual(3)
    expect(result).toHaveProperty('output.a', null)
    expect(result).toHaveProperty('output.b.error', 'Did not match any from the listed types')
  })

  it('can use type definitions', () => {
    const schema: Validation = {
      $types: { $range: { $number: { min: 1, max: 99 } } },
      a: 'number',
      b: '$range'
    }

    expect(validate(schema, { a: 2, b: 43 })).toHaveProperty('result', 'pass')
    expect(validate(schema, { a: 2, b: 101 })).toHaveProperty('result', 'fail')
    expect(validate(schema, { a: 2, b: 0 })).toHaveProperty('result', 'fail')
  })

  it('type definitions can reference each other.', () => {
    const schema: Validation = {
      $types: {
        $myObject: { itsRange: '$range', name: 'string' },
        $range: { $number: { min: 1, max: 99 } }
      },
      a: '$myObject',
      b: '$range'
    }

    expect(validate(schema, { a: { name: 'abc', itsRange: 22 }, b: 43 })).toHaveProperty('result', 'pass')
    expect(validate(schema, { a: { name: 'abc', itsRange: 101 }, b: 43 })).toHaveProperty('result', 'fail')
    expect(validate(schema, { a: { name: 'abc', itsRange: 22 }, b: 0 })).toHaveProperty('result', 'fail')
    expect(validate(schema, { a: 2, b: 0 })).toHaveProperty('result', 'fail')
  })
})
