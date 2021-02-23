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
  t.is(validate(example, { }).result, 'fail')

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
  fs.writeFileSync('../test_out.json', JSON.stringify(validated, null, 2))
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

  t.deepEqual(result.output, {
    num: { error: 'Value is not a number', value: 'abc' },
    int: { error: 'Value is not an integer ', value: undefined },
    str: { error: 'Value is not a string', value: undefined },
    bool: { error: 'Value is not a boolean', value: undefined },
    obj: { error: 'Value is not an Object', value: undefined }
  })

  const result2 = validate(type, { int: 123.3, str: [], bool: 'true', obj: {} })

  t.is(result2.result, 'fail')
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

  t.is(result.result, 'pass')
  t.deepEqual(result.output, {
    obj: {
      member: null,
      nested: { inside: null },
      memberId: null
    }
  })
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
  class Test1 { constructor (public readonly a: number) {} }
  const input: any = new Test1(4)
  // eslint-disable-next-line no-proto
  input.__proto__.b = 3
  const result: any = validate(schema, input)
  t.is(result.output?.a, null)
  t.is(result.output.b.error, 'Did not match any from the listed types')
})
