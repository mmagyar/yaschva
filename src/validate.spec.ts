/* eslint-disable dot-notation */
import test, { ExecutionContext } from 'ava'

import { validate, loadJson } from './validate.js'
import { Validation } from './validationTypes.js'
import fs from 'fs'
import path from 'path'
import { inspect } from 'util'

inspect.defaultOptions.depth = null

const file = fs.promises.readFile
let loaded: Validation
const schemaSchema = (): Validation => {
  if (!loaded) { loaded = loadJson(fs.readFileSync('./selfSchema.json', 'utf8')) }
  return loaded
}

test.afterEach(() => {
  // eslint-disable-next-line no-proto
  delete ({} as any).__proto__.b
})
const validSchema = (schema: Validation, t: ExecutionContext): Validation => {
  const validated = validate(schemaSchema(), schema)
  t.is(validated.result, 'pass', JSON.stringify(validated, null, 2) +
    '\n\nInvalid Schema\n\n')

  return schema
}

const invalidSchema = (schema: any, t: ExecutionContext): Validation => {
  const validated = validate(schemaSchema(), schema)
  t.is(validated.result, 'fail', JSON.stringify(validated, null, 2) +
    '\n\nValid Schema, expected invalid\n\n')
  return schema
}

const valid = (schema: Validation, data: any, t: ExecutionContext): void => {
  const dataValid = validate(validSchema(schema, t), data)
  t.is(dataValid.result, 'pass', JSON.stringify(dataValid, null, 2) +
    '\n\nData validation failed, but it should have passed\n')
}

const invalid = (schema: Validation, data: any, t: ExecutionContext): void => {
  const dataValid = validate(validSchema(schema, t), data)
  t.is(dataValid.result, 'fail', JSON.stringify(dataValid, null, 2) +
    '\n\nData validation passed, but it should have failed\n')
}

const loadAndAddTestsBasedOnJsonDefinitions = (): void => {
  const testJsonFolder = './src/tests'
  const dirs = fs.readdirSync(testJsonFolder)

  dirs.forEach(x => {
    if (x.endsWith('json')) {
      const file = fs.readFileSync(path.join(testJsonFolder, x), 'utf-8')
      const json = JSON.parse(file)
      json.forEach((element: any, i: number) => {
        const indexName = element.name ? ` ${element.name}` : json.length > 1 ? ` > ${i}` : ''

        if (element.invalidSchema) {
          const invalidData = element.invalidData || []
          if (!invalidData.length) {
            test(`${x}${indexName} > invalid schema`, t => {
              invalidSchema(element.invalidSchema, t)
            })
          } else {
            invalidData.forEach((z: any, j: number) => {
              test(`${x}${indexName} > invalid data > ${j}`, t => {
                const schema = invalidSchema(element.invalidSchema, t)
                if (element.throws) {
                  const error = t.throws(() => validate(schema, z))
                  if (typeof element.throws === 'string') {
                    t.is(error.message, typeof element.throws === 'string' ? element.throws : undefined)
                  }
                } else {
                  t.is(validate(schema, z).result, 'fail')
                }
              })
            })
          }
        }

        if (element.schema) {
          const validData = element.validData || []
          const invalidData = element.invalidData || []
          validData.forEach((z: any, j: number) => {
            test(`${x}${indexName} > valid data > ${j}`, (t) => valid(element.schema, z, t))
          })

          invalidData.forEach((z: any, j: number) => {
            test(`${x}${indexName} > invalid data > ${j}`, (t) => invalid(element.schema, z, t))
          })

          if (!validData.length && !invalidData.length) {
            test(`${x}${indexName} > invalid test`, (t) =>
              t.fail('This test did not define a valid or invalid test data for a valid schema. Cannot run test.'))
          }
        }

        if (!element.schema && !element.invalidSchema) {
          test(`${x}${indexName} > invalid test`, (t) =>
            t.fail('This test did not define a schema or an invalidSchema. Cannot run test.'))
        }
      })
    }
  })
}

loadAndAddTestsBasedOnJsonDefinitions()

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
  t.is(validate(example, data).result, 'pass')
  t.is(validate(example, {}).result, 'fail')

  t.deepEqual(validate(example, {}), {
    result: 'fail',
    output: {
      error: 'objectResult',
      depth: 2,
      errorCount: 10,
      objectResults: {
        myAddress: { error: 'Value is not an Object', value: undefined, depth: 1 },
        myString: { error: 'Value is not a string', value: undefined, depth: 1 },
        myOptionalString: null,
        myObject: { error: 'Value is not an Object', value: undefined, depth: 1 },
        myArrayOfNumbers: { error: 'Value is not an Array', value: undefined, depth: 1 },
        myEnum: { error: 'Value is not a string', value: undefined, depth: 1 },
        myKeyValuePairs: {
          error: 'Value is not a Map (freeform Object)',
          value: undefined,
          depth: 1
        },
        myMultiType: {
          error: 'Did not match any from the listed types',
          value: undefined,
          depth: 2,
          output: [
            {
              error: 'Value is not a string',
              value: undefined,
              depth: 2
            },
            {
              error: 'Value is not a number',
              value: undefined,
              depth: 2
            }
          ]
        },
        myNumberRange: { error: 'Value is not a number', value: undefined, depth: 1 },
        myNull: { error: 'Value is not null', value: undefined, depth: 1 },
        myRegex: { error: 'Value is not a string', value: undefined, depth: 1 }
      }
    } as any
  })
})

test('Can validate itself with itself', async (t) => {
  const example = loadJson(await file('./selfSchema.json', 'utf8'))
  const validated = validate(example, example)
  t.is(validated.result, 'pass')
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

  t.is(result.result, 'fail')
  console.log(result.output)
  t.deepEqual(result.output, {
    error: 'objectResult',
    errorCount: 5,
    objectResults: {
      num: { error: 'Value is not a number', value: 'abc', depth: 1 },
      int: { error: 'Value is not an integer ', value: undefined, depth: 1 },
      str: { error: 'Value is not a string', value: undefined, depth: 1 },
      bool: { error: 'Value is not a boolean', value: undefined, depth: 1 },
      obj: { error: 'Value is not an Object', value: undefined, depth: 1 }
    },
    depth: 1
  } as any)

  const result2 = validate(type, { int: 123.3, str: [], bool: 'true', obj: {} })

  t.is(result2.result, 'fail')
  t.deepEqual(result2.output, {
    error: 'objectResult',
    errorCount: 5,
    objectResults: {
      int: { error: 'Value is not an integer ', value: 123.3, depth: 1 },
      str: {
        error: 'Value is not a string',
        value: '[object ommited]',
        depth: 1
      },
      bool: { error: 'Value is not a boolean', value: 'true', depth: 1 },
      obj: {
        error: 'objectResult',
        errorCount: 1,
        objectResults: {
          member: { error: 'Value is not a boolean', value: undefined, depth: 2 },
          memberId: null
        },
        depth: 2
      },
      num: { error: 'Value is not a number', value: undefined, depth: 1 }
    },
    depth: 2
  } as any)
})

test('Uses null to signal that there is no error for a given property', (t) => {
  const type = validSchema({
    obj: { member: 'boolean', memberId: ['string', '?'], nested: { inside: 'string' } }
  }, t)
  const result = validate(type, { obj: { member: false, nested: { inside: 'hello' } } })

  t.is(result.result, 'pass')
  t.deepEqual(result.output, {
    error: 'objectResult',
    errorCount: 0,
    objectResults: {
      obj: {
        error: 'objectResult',
        errorCount: 0,
        objectResults: {
          member: null,
          nested: {
            error: 'objectResult',
            errorCount: 0,
            objectResults: { inside: null },
            depth: 2
          },
          memberId: null
        },
        depth: 2
      }
    },
    depth: 2
  } as any)
})

test('Most likely error is first on the error output', (t) => {
  const type = validSchema([
    { member: 'boolean', memberId: ['string', '?'] },
    { aValue: 'string', nested: { inside: 'string' } },
    'number'
  ], t)

  const result = validate(type, { aValue: 'asdf' })
  console.log(result.output)

  // with such simple input, we just use the order of declaration
  t.deepEqual(validate(type, 'a string').output, {
    error: 'Did not match any from the listed types',
    depth: 1,
    value: 'a string',
    output: [
      { error: 'Value is not an Object', depth: 1, value: 'a string' },
      { error: 'Value is not an Object', depth: 1, value: 'a string' },
      { error: 'Value is not a number', depth: 1, value: 'a string' }
    ]
  })

  // The input data has one field correct from the object option,
  // so we show the error message ragrding the object first
  // The option with the least number of errors will be first
  t.deepEqual(validate(type, { member: true, memberId: 3 }).output,
    {
      error: 'Did not match any from the listed types',
      depth: 3,
      value: '[object ommited]',
      output: [
        {
          error: 'objectResult',
          depth: 3,
          errorCount: 1,
          objectResults: {
            member: null,
            memberId: {
              error: 'Did not match any from the listed types',
              depth: 3,
              value: 3,
              output: [
                { error: 'Value is not a string', depth: 3, value: 3 },
                { error: 'Value is not undefined', depth: 3, value: 3 }
              ]
            }
          }
        },
        {
          error: 'objectResult',
          depth: 2,
          errorCount: 4,
          objectResults: {
            member: {
              error: 'Key does not exist on validator',
              depth: 1,
              value: true
            },
            memberId: {
              error: 'Key does not exist on validator',
              depth: 1,
              value: 3
            },
            aValue: { error: 'Value is not a string', depth: 2, value: undefined },
            nested: { error: 'Value is not an Object', depth: 2, value: undefined }
          }
        },
        {
          error: 'Value is not a number',
          depth: 1,
          value: '[object ommited]'
        }
      ]
    } as any
  )

  t.deepEqual(validate(type, { aValue: 'asdf' }).output,
    {
      error: 'Did not match any from the listed types',
      depth: 2,
      value: '[object ommited]',
      output: [
        {
          error: 'objectResult',
          depth: 2,
          errorCount: 1,
          objectResults: {
            aValue: null,
            nested: { error: 'Value is not an Object', depth: 2, value: undefined }
          }
        },
        {
          error: 'objectResult',
          depth: 2,
          errorCount: 2,
          objectResults: {
            aValue: {
              error: 'Key does not exist on validator',
              depth: 1,
              value: 'asdf'
            },
            member: { error: 'Value is not a boolean', depth: 2, value: undefined },
            memberId: null
          }
        },
        {
          error: 'Value is not a number',
          depth: 1,
          value: '[object ommited]'
        }
      ]
    })

  // If a tree matches our data deeper, it will be shown first, even with more errors
  // todo write test for it.
})

test('Throws on undefined', (t) => {
  t.throws(() => validate(invalidSchema(undefined, t), {}), null
    , 'Type for validation cannot be undefined')
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
  class Test1 { constructor (public readonly a: number) { } }
  const input: any = new Test1(4)
  // eslint-disable-next-line no-proto
  input.__proto__.b = 3
  const result: any = validate(schema, input)
  t.is(result.output?.objectResults.a, null)
  t.is(result.output.objectResults.b.error, 'Did not match any from the listed types')
})

/**
 * This test is important, but it wont work until a make a type for custom types in root:
 *   {
    "name": "Root can be a custom type via a meta type",
    "schema": {
      "$types": {
        "$customType": {
          "value": "string",
          "nodes": { "$array": "$customType" }
        }
      },
      "$type": "$customType"
    },
    "validData": [
      { "value": "abc", "nodes": [] },
      { "value": "abc", "nodes": [{ "value": "xyz", "nodes": [] }] },
      {
        "value": "abc",
        "nodes": [
          { "value": "xyz", "nodes": [{ "value": "xyz", "nodes": [] }] }
        ]
      }
    ],
    "invalidData": [
      {},
      { "value": "abc" },
      { "value": "abc", "nodes": [{ "nodes": [] }] },
      { "value": "abc", "nodes": [{ "value": "xyz" }] }
    ]
  },
 */
