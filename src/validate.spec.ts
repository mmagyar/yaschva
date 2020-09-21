/* eslint-disable dot-notation */
import test, { ExecutionContext } from 'ava'

import { validate, loadJson } from './validate.js'
import { Validation } from './validationTypes.js'
import fs from 'fs'
import { inspect } from 'util'
inspect.defaultOptions.depth = null

const file = fs.promises.readFile
let loaded:Validation
const schemaSchema = () => {
  if (!loaded) { loaded = loadJson(fs.readFileSync('./selfSchema.json', 'utf8')) }
  return loaded
}
test.afterEach(() => {
  // eslint-disable-next-line no-proto
  delete ({} as any).__proto__.b
})
const validSchema = (schema:Validation, t:ExecutionContext):Validation => {
  const validated = validate(schemaSchema(), schema)
  t.is(validated.result, 'pass', JSON.stringify(validated, null, 2) +
        '\n\nInvalid Schema\n\n')

  return schema
}

const invalidSchema = (schema:any, t:ExecutionContext):Validation => {
  const validated = validate(schemaSchema(), schema)
  t.is(validated.result, 'fail', JSON.stringify(validated, null, 2) +
        '\n\nValid Schema, expected invalid\n\n')
  return schema
}

const valid = (schema:Validation, data:any, t:ExecutionContext) => {
  const dataValid = validate(validSchema(schema, t), data)
  t.is(dataValid.result, 'pass', JSON.stringify(dataValid, null, 2) +
      '\n\nData validation failed, but it should have passed\n')
}

const invalid = (schema:Validation, data:any, t:ExecutionContext) => {
  const dataValid = validate(validSchema(schema, t), data)
  t.is(dataValid.result, 'fail', JSON.stringify(dataValid, null, 2) +
      '\n\nData validation passed, but it should have failed\n')
}

test('Shows example schema working', async (t) => {
  const example = loadJson(await file('./examples/example1.json', 'utf8'))
  validSchema(example, t)
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
  t.is(validate(example, data)['result'], 'pass')
  t.is(validate(example, { })['result'], 'fail')

  t.deepEqual(validate(example, { }), {
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

test('Can validate itself with itself', async (t) => {
  const example = loadJson(await file('./selfSchema.json', 'utf8'))
  const validated = validate(example, example)
  t.is(validated['result'], 'pass')
})

test('Passes validation for correct simple values', (t) => {
  valid('string', 'hello', t)
  valid('integer', 123, t)
  valid('number', 123.3, t)
  valid('boolean', true, t)
  valid('?', undefined, t)
  valid('null', null, t)
  valid('any', 233, t)
  valid({ $type: 'string' }, 'desert', t)
})

test('Fails validation for incorrect simple values', async (t) => {
  invalid('string', 234, t)
  invalid('integer', 123.4, t)
  invalid('integer', '123', t)
  invalid('number', '123.4', t)
  invalid('boolean', 'true', t)
  invalid('?', 'yes', t)
  invalid('null', 'no', t)
  invalid('null', undefined, t)

  // Fails for non safe integer above 2^53
  invalid('integer', 12332323423445323, t)

  // any does not fail for any data type
})

test('Passes objects with correct values', (t) => {
  valid({}, {}, t)
  valid({ myNumber: 'number' }, { myNumber: 12.3 }, t)
  valid({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
    { num: 12.3, int: 12, str: 'Hello', bool: false }, t)
})

test('Fails objects with missing properties', (t) => {
  invalid({ myNumber: 'number' }, {}, t)
  invalid({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
    { num: 3 }, t)
})

test('Fails objects with incorrect values', (t) => {
  invalid({}, null, t)
  invalid({ num: 'number', int: 'integer', str: 'string', bool: 'boolean' },
    JSON.stringify({ num: 12.3, int: 12, str: 'Hello', bool: false }), t)
})

test('Can handle multiple type for a single value', (t) => {
  valid(['integer', 'string'], 'hello', t)
  valid(['integer', 'string'], 123, t)
  invalid(['integer', 'string'], {}, t)
})

test('Handles optional values via multi-types', (t) => {
  valid(['integer', 'string', '?'], 'hello', t)
  valid(['integer', 'string', '?'], 123, t)
  valid(['integer', 'string', '?'], undefined, t)
  invalid(['integer', 'string', '?'], {}, t)

  const type: Validation = { myValue: ['integer', 'string', '?'] }
  valid(type, { myValue: 1233232342344532 }, t)
  valid(type, { myValue: 'abc' }, t)
  valid(type, {}, t)
  invalid(type, undefined, t)
})

test('Handles arrays with special syntax', (t) => {
  valid({ $array: 'string' }, ['hello'], t)
  valid({ $array: 'string' }, ['hello', 'abc'], t)
  valid({ $array: 'string' }, [], t)
  invalid({ $array: 'string' }, [2], t)
  invalid({ $array: 'string' }, 'hello', t)
  valid(['integer', { $array: ['string'] }], ['true', 'this'], t)
  invalid(['integer', { $array: ['string'] }], [1], t)
})

test('Handles enums with special syntax', (t) => {
  const type: Validation = { $enum: ['ts', 'typescript'] }
  valid(type, 'ts', t)
  valid(type, 'typescript', t)
  invalid(type, 'javascript', t)
  invalid(type, ['ts'], t)
  invalid(type, { $enum: 'ts' }, t)
})

test('Provides useful error description', (t) => {
  const type = validSchema({
    num: 'number',
    int: 'integer',
    str: 'string',
    bool: 'boolean',
    obj: { member: 'boolean', memberId: ['string', '?'] }
  }, t)
  const result = validate(type, { num: 'abc' })

  t.is(result['result'], 'fail')

  t.deepEqual(result.output, {
    num: { error: 'Value is not a number', value: 'abc' },
    int: { error: 'Value is not an integer ', value: undefined },
    str: { error: 'Value is not a string', value: undefined },
    bool: { error: 'Value is not a boolean', value: undefined },
    obj: { error: 'Value is not an Object', value: undefined }
  })

  const result2 = validate(type, { int: 123.3, str: [], bool: 'true', obj: {} })

  t.is(result2['result'], 'fail')
  t.deepEqual(result2.output, {
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

test('Uses null to signal that there is no error for a given property', (t) => {
  const type = validSchema({
    obj: { member: 'boolean', memberId: ['string', '?'], nested: { inside: 'string' } }
  }, t)
  const result = validate(type, { obj: { member: false, nested: { inside: 'hello' } } })

  t.is(result['result'], 'pass')
  t.deepEqual(result.output, {
    obj: {
      member: null,
      nested: { inside: null },
      memberId: null
    }
  })
})

test('Rejects objects with additional keys', (t) => {
  invalid({ myValue: 'integer' }, { myValue: 2, ourValue: 3 }, t)
})

test('Throws on type definition with empty array of types', (t) => {
  const malformedSchema = invalidSchema({ myValue: [] }, t)
  t.throws(() => validate(malformedSchema, { myValue: 2 }))
})

test('Throws on unknown type definition', (t) => {
  t.throws(() => validate(invalidSchema({ myValue: 'bigFlout' }, t), { myValue: 2 }), null
    , 'Unknown validator:"bigFlout"')

  t.throws(() => validate(invalidSchema({ $whatever: 'bigFloat' }, t), { myValue: 2 }), null
    , 'Unknown validator:{"$whatever":"bigFloat"}')

  t.throws(() => validate(invalidSchema(undefined, t), {}), null
    , 'Type for validation cannot be undefined')
})

test('Reserves keys starting with $ (dollar sign) for type data', (t) => {
  t.throws(() => validate(invalidSchema({ $whatever: 'string' }, t), { $whatever: 2 }))
})

test('Can validate string length', (t) => {
  const schema = validSchema({ $string: { minLength: 4, maxLength: 6 } }, t)
  t.deepEqual(validate(schema, 'abc'), {
    result: 'fail',
    output: {
      error: 'String is shorter than the required minimum length', value: 'abc'
    }
  })

  t.deepEqual(validate(schema, 'Lorem ipsum'), {
    result: 'fail',
    output: {
      error: 'String is longer than the required maximum length', value: 'Lorem ipsum'
    }
  })

  valid(schema, 'hello', t)
})

test('Can validate string by regex', (t) => {
  const schema = validSchema({ $string: { regex: 'hello \\w+' } }, t)
  t.deepEqual(validate(schema, 'abc'), {
    result: 'fail',
    output: {
      error: 'String did not match required regex', value: 'abc'
    }
  })

  valid(schema, 'hello world', t)
})

test('Can enforce maximum / minimum number', (t) => {
  const schema = validSchema({ $number: { min: 1, max: 66 } }, t)

  t.deepEqual(validate(schema, 0), {
    result: 'fail',
    output: { error: 'Value is smaller than the required minimum', value: 0 }
  })

  t.deepEqual(validate(schema, 67), {
    result: 'fail',
    output: { error: 'Value is bigger than the required maximum', value: 67 }
  })

  t.is(validate(schema, 44.5)['result'], 'pass')
})

test('Can enforce maximum / minimum number as integers', (t) => {
  const schema = validSchema({ $number: { min: 1, max: 66, integer: true } }, t)

  t.is(validate(schema, 0)['result'], 'fail')

  t.is(validate(schema, 67)['result'], 'fail')

  t.is(validate(schema, 44.5)['result'], 'fail')
  t.is(validate(schema, 44)['result'], 'pass')
})

test('Can validate key value pairs (map)', (t) => {
  const schema: Validation = { $map: ['number'] }
  valid(schema, { x: 3, y: 4, z: 99 }, t)
  invalid(schema, { x: 3, y: 4, z: '99' }, t)
  invalid(schema, { x: 3, y: 'a string', z: 34 }, t)
})

test('Key value pair keys can be regex validated', (t) => {
  const schema: Validation = { $map: ['number'], key: { $string: { regex: '^ab[a-z]' } } }
  valid(schema, { abx: 3, aby: 4, abz: 99 }, t)
  invalid(schema, { x: 3, y: 4, z: 99 }, t)
  invalid(schema, { abx: 3, aby: 'a string', abz: 34 }, t)
})

// test('Protects against global object prototype injection', (t) => {
//   const schema = validSchema({ a: 'number', b: ['string', '?'] }, t)
//   const input: any = { a: 4 }
//   // eslint-disable-next-line no-proto
//   input.__proto__.b = 99
//   const result:any = validate(schema, input)
//   t.is(result['output']?.a, null)
//   t.is(result.output.b.error, 'Did not match any from the listed types')
// })

test('Protects against prototype injection on class', (t) => {
  const schema = validSchema({ a: 'number', b: ['string', '?'] }, t)
  // eslint-disable-next-line no-useless-constructor
  class Test1 { constructor (public readonly a: number) {} }
  const input: any = new Test1(4)
  // eslint-disable-next-line no-proto
  input.__proto__.b = 3
  const result:any = validate(schema, input)
  t.is(result['output']?.a, null)
  t.is(result.output.b.error, 'Did not match any from the listed types')
})

test('Protects against prototype injection from json', (t) => {
  const schema = validSchema({ a: 'number', b: ['string', '?'] }, t)
  const input: any = JSON.parse('{ "a": 5, "__proto__": {"b" : 3} }')
  const input2 = { ...input }
  const result :any = validate(schema, input2)
  t.is(input2.b, 3)
  t.is(result['output']?.a, null)
  t.is(result.output.b.error, 'output.b.error',
    'Did not match any from the listed types')
})

test('Can use type definitions', (t) => {
  const schema = validSchema({
    $types: { $range: { $number: { min: 1, max: 99 } } },
    a: 'number',
    b: '$range'
  }, t)

  valid(schema, { a: 2, b: 43 }, t)
  invalid(schema, { a: 2, b: 101 }, t)
  invalid(schema, { a: 2, b: 0 }, t)
})

test('Type definitions can reference each other.', (t) => {
  const schema: Validation = {
    $types: {
      $myObject: { itsRange: '$range', name: 'string' },
      $range: { $number: { min: 1, max: 99 } }
    },
    a: '$myObject',
    b: '$range'
  }

  valid(schema, { a: { name: 'abc', itsRange: 22 }, b: 43 }, t)
  invalid(schema, { a: { name: 'abc', itsRange: 101 }, b: 43 }, t)
  invalid(schema, { a: { name: 'abc', itsRange: 22 }, b: 0 }, t)
  invalid(schema, { a: 2, b: 0 }, t)
})

test('$ sign can be escaped in the schema and used for data key', (t) => {
  const validated:any = validate(
    validSchema({ myNumber: 'number', '\\$escapedDollar': 'string' }, t),
    { myNumber: 12.3, $escapedDollar: 'value' })
  t.is(validated['result'], 'pass')
  t.is(validated.output?.['$escapedDollar'], null)

  const validated2:any = validate(
    validSchema({ myNumber: 'number', '\\$escapedDollar': 'string' }, t),
    { myNumber: 12.3, $escapedDollar: 234 })
  t.is(validated2['result'], 'fail')
  t.deepEqual(validated2.output.$escapedDollar,
    { error: 'Value is not a string', value: 234 })
})

test('Root can be a meta type', (t) => {
  valid({ $type: { $array: 'string' } }, ['a', 'b', 'c'], t)
})

test('Root can be a custom type via a meta type', (t) => {
  const validated = validate({
    $types: { $customType: { value: 'string', nodes: { $array: '$customType' } } },
    $type: '$customType'
  }, { value: 'abc', nodes: [{ value: 'xyz', nodes: [] }] })
  t.is(validated['result'], 'pass')
})

test('Can validated recursive data structure', (t) => {
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
  }, t)
})

test('Can validate to multiple objects with $and', (t) => {
  const schema:Validation = {
    $and: [
      { valueA: 'string' },
      { valueB: 'number' },
      { $type: { otherValue: 'number' } }]
  }
  valid(schema, { valueA: 'someString', valueB: 32, otherValue: 9 }, t)
})

test('When and $and is specified input must satisfy both objects', (t) => {
  invalid({ $and: [{ valueA: 'string' }, { valueB: 'number' }] },
    { valueA: 'someString' }, t)
})

test('$and only accepts object', (t) => {
  const schema:Validation = { $and: [{ valueA: 'string' }, 'string'] }
  invalid(schema, { valueA: 'someString' }, t)
})

test('Can validate to multiple custom types with $and', (t) => {
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
  }, t)
})

test('Will reject arrays that are too short', (t) => {
  invalid({ $array: 'string', minLength: 3 }, ['abc', 'efg'], t)
})

test('Will reject arrays that are too long', (t) => {
  invalid({ $array: 'string', maxLength: 3 }, ['abc', 'efg', 'some', 'value'], t)
})

test('Will accept arrays that has a length between the constraints', (t) => {
  valid({ $array: 'string', minLength: 1, maxLength: 3 }, ['some', 'value'], t)
})

test('Will reject maps with too few properties', (t) => {
  invalid({ $map: 'string', minLength: 3 }, { a: 'abc', b: 'efg' }, t)
})

test('Will reject maps with too many properties', (t) => {
  invalid({ $map: 'string', maxLength: 3 }, { a: 'abc', e: 'efg', c: 'some', d: 'value' }, t)
})

test('Will accept maps that has a property count between constraints', (t) => {
  valid({ $map: 'string', minLength: 1, maxLength: 3 }, { a: 'some', x: 'value' }, t)
})

test('Can specify types for some keys in map', (t) => {
  valid({ $map: 'string', keySpecificType: { a: 'number' } }, { a: 12, x: 'value' }, t)

  invalid({ $map: 'string', keySpecificType: { a: 'number' } }, { a: 'str', x: 'value' }, t)
})

test('Can specify types for some keys in map, use a defined type', (t) => {
  const schema = {
    $types: { $customNumber: { $number: { min: 2 } } },
    $map: 'string',
    keySpecificType: { a: '$customNumber' }
  }
  valid(schema, { a: 3, x: 'value' }, t)
  invalid(schema, { a: 1, x: 'value' }, t)
})

test('Map specified keys most be either an object or a defined type, simple string will throw', (t) => {
  const schema = invalidSchema({ $map: 'string', keySpecificType: 'some' }, t)
  t.throws(() => validate(schema, { x: 'value' }), undefined, 'Invalid keySpecificType: some')
})

test('Map specified keys are mandatory', (t) => {
  invalid({ $map: 'string', keySpecificType: { a: 'number' } }, { x: 'value' }, t)
})

test('can restrict a string to be one of the keys of the root object on the input', (t) => {
  const schema = validSchema({
    keyA: 'number',
    keyB: 'number',
    keyC: ['number', '?'],
    myRes: { $map: 'string', key: { $keyOf: [] } }
  }, t)
  valid(schema, { keyA: 1, keyB: 2, myRes: { keyA: 'a', keyB: 'b' } }, t)
  valid(schema, { keyA: 1, keyB: 2, myRes: { keyA: 'a', keyB: 'b' } }, t)
  invalid(schema, { keyA: 1, keyB: 2, myRes: { keyA: 'a', keyC: 'b' } }, t)
  invalid(schema, { keyA: 1, keyB: 2, myRes: { keyA: 'a', keyX: 'b' } }, t)
})

test('can restrict a string to be one of the keys on an object under root on the input', (t) => {
  const schema = validSchema({
    keyA: {
      x: 'number',
      y: ['?', 'number']
    },
    keyB: 'number',
    keyC: ['number', '?'],
    myRes: { $map: 'string', key: { $keyOf: ['keyA'] } }
  }, t)
  valid(schema, { keyA: { x: 1, y: 2 }, keyB: 2, myRes: { x: 'one', y: 'two' } }, t)
  valid(schema, { keyA: { x: 1, y: 2 }, keyB: 2, myRes: { x: 'one' } }, t)

  invalid(schema, { keyA: { x: 1 }, keyB: 2, myRes: { x: 'one', y: 'two' } }, t)
  invalid(schema, { keyA: { x: 1, y: 2 }, keyB: 2, myRes: { keyA: 'a', keyB: 'b' } }, t)
})

test('invalid keyOf detected at schema validation', (t) => {
  const schema = invalidSchema({
    keyA: 'number',
    keyB: { $keyOf: ['axz'] }
  }, t)
  t.is(validate(schema, { keyA: 2 })['result'], 'fail')
})
