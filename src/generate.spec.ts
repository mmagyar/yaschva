import { Validation } from './validationTypes.js'
import { generate, randomNumber } from './generate.js'
import { loadJson, validate } from './validate.js'
import fs from 'fs'
import { inspect } from 'util'
import test, { ExecutionContext } from 'ava'
import path from 'path'
inspect.defaultOptions.depth = null

const file = fs.promises.readFile
const checkNumber = (result: number, t: ExecutionContext): void => {
  t.not(result, Infinity)
  t.not(isNaN(result), true)
  t.is(typeof result, 'number')
}

test('Generates a random number that is not infinity or NaN', (t) => {
  for (let i = 0; i < 32; i += 1) {
    checkNumber(randomNumber(false, 0, 100), t)
    const int = randomNumber(true, -10, 99)
    checkNumber(int, t)
    t.true(Number.isSafeInteger(int))
    t.true(int >= -10)
    t.true(int <= 99)
  }
})

test('Generates simple types', (t) => {
  const schema: Validation = {
    string: 'string',
    number: 'number',
    any: 'any',
    null: 'null',
    optional: '?',
    boolean: 'boolean',
    integer: 'integer'
  }
  const anyGenerated = []
  for (let i = 0; i < 32; i++) {
    const result = generate(schema)
    t.is(typeof result.string, 'string')
    t.is(typeof result.number, 'number')
    t.is(typeof result.boolean, 'boolean')
    t.is(result.null, null)
    t.true(Number.isSafeInteger(result.integer))
    if (result.any === undefined) anyGenerated.push(result.any)
    t.is(result.optional, undefined)
    t.is(validate(schema, result).result, 'pass')
  }

  // Make sure any generates non undefined values as well
  t.true(anyGenerated.length > 0)
})

test('Generates on of multiple types', (t) => {
  const schema: Validation = {
    stringOrNumber: ['string', 'number'],
    optionalString: ['?', 'string']
  }
  const result = generate(schema)
  t.true(typeof result.stringOrNumber === 'string' ||
    typeof result.stringOrNumber === 'number')
  t.true(result.optionalString === undefined || typeof result.optionalString === 'string')
  t.is(validate(schema, result).result, 'pass')
})

test('Generates arrays', (t) => {
  const schema: Validation = {
    stringOrNumber: { $array: ['string', 'number'] },
    objArray: { $array: { hello: 'string', world: 'number' } }
  }
  const result = generate(schema)
  t.true(Array.isArray(result.stringOrNumber))
  result.stringOrNumber
    .forEach((x: any) => t.true(typeof x === 'string' || typeof x === 'number'))

  t.true(Array.isArray(result.objArray))
  result.objArray
    .forEach((x: any) => {
      t.true(typeof x === 'object' && x !== null)
      t.true(typeof x.hello === 'string')
      t.true(typeof x.world === 'number')
    })
  t.is(validate(schema, result).result, 'pass')
})

test('Generates enum', (t) => {
  const enums = ['lolly', 'pop', 'chewingGum', 'doughnut']
  const schema: Validation = {
    enum: { $enum: enums }
  }
  const result = generate(schema)
  t.true(enums.some(x => x === result.enum))
  t.is(validate(schema, result).result, 'pass')
})

test('Generates object meta', (t) => {
  const schema: Validation = {
    meta: {
      name: 'object with name',
      $type: { here: 'string' }
    }
  }
  const result = generate(schema)
  t.truthy(result.meta)
  t.truthy(result.meta.here)
  t.true(typeof result.meta.here === 'string')
  t.is(validate(schema, result).result, 'pass')
})

test('Generates map (key value pairs)', (t) => {
  const schema: Validation = {
    map: { $map: 'number' }
  }
  const result = generate(schema)
  t.truthy(result.map)
  t.true(typeof result.map === 'object' && result.map !== null)
  const values = Object.values(result.map)
  t.true(values.length >= 1)
  t.true(values.length <= 33)
  values.forEach(x => t.true(typeof x === 'number'))
  t.is(validate(schema, result).result, 'pass')
})

test('Key value pair keys can be regex validated', (t) => {
  const schema: Validation = { $map: ['number'], regex: '^ab[a-z]' }
  const generated = generate(schema, { mapMin: 5 })
  t.true(Object.keys(generated).length > 1)
  t.is(validate(schema, generated).result, 'pass')
})

test('Generates bound number', (t) => {
  const schema: Validation = { $number: { min: 33, max: 45 } }
  const result = generate(schema)
  t.true(result >= 33)
  t.true(result <= 45)
})

test('Generates unbound number', (t) => {
  const schema: Validation = { $number: {} }
  const result = generate(schema)
  t.is(typeof result, 'number')
})

test('Generates extended simple type', (t) => {
  const result = generate({ $type: 'string' })
  t.true(typeof result === 'string')
})

test('Generates extended string', (t) => {
  const result = generate({ $string: { minLength: 77 } })
  t.true(typeof result === 'string')
  t.true(result.length >= 77)

  const result2 = generate({ $string: { maxLength: 33 } })
  t.true(typeof result2 === 'string')
  t.true(result2.length <= 33)

  t.is(typeof generate({ $string: {} }), 'string')
})

test('Throws on unknown type', (t) => {
  const test = (): void => {
    const schema: any = { $stringss: { minLength: 77 } }
    generate(schema)
  }

  t.throws(test)

  const test2 = (): void => {
    const schema: any = { something: 'magicRune' }
    generate(schema)
  }

  t.throws(test2)
})

test('Generates example from parsed json', async (t) => {
  const a = loadJson(JSON.parse(await file('./examples/example1.json', 'utf8')))

  t.is(validate(a, generate(a)).result, 'pass')
})

test('Generates example from string', async (t) => {
  const a = loadJson(await file('./examples/example1.json', 'utf8'))

  t.is(validate(a, generate(a)).result, 'pass')
})

test('Generates string based on regex', (t) => {
  const result = generate({ $string: { regex: '\\b(\\w*work\\w*)\\b' } })
  t.true(typeof result === 'string')
  t.true(result.includes('work'))
})

test('Generates uuid based on regex', (t) => {
  const regex = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}'
  for (let i = 0; i < 240; i++) {
    const result = generate({ id: { $string: { regex } } })
    t.is(typeof result.id, 'string')
  }
})

test('Does not add property to object if it\'s optionally undefined', (t) => {
  const undefinedGenerated = []
  for (let i = 0; i < 240; i++) {
    const result = generate({ value: ['string', '?'] })
    if (Object.keys(result).includes('value')) {
      t.is(typeof result.value, 'string')
    } else {
      t.is(Object.keys(result).length, 0)
      undefinedGenerated.push(result)
    }
  }
  t.true(undefinedGenerated.length > 0)
})

test('$ sign can be escaped in the schema and used for data key', (t) => {
  const validated = generate({ myNumber: 'number', '\\$escapedDollar': 'string' })
  t.truthy(validated.myNumber)
  t.truthy(validated.$escapedDollar)
})

test('Generates empty array for array of undefined', (t) => {
  const schema = { $array: '?' }
  const generated = generate(schema)
  const validated = validate(schema, generated)
  t.is(validated.result, 'pass')
  t.is(validate(schema, JSON.parse(JSON.stringify(generated))).result, 'pass')
})

test('Can prefer undefined type if present', (t) => {
  const schema: Validation = {
    root: 'string',
    aNumber: ['number'],
    mayBeUndefined: ['string', '?']
  }
  const generated = generate(schema, { prefer: 'undefined' })
  t.is(typeof generated.root, 'string')
  t.is(typeof generated.aNumber, 'number')
  t.is(typeof generated.mayBeUndefined, 'undefined')
  const validated = validate(schema, generated)
  t.is(validated.result, 'pass')
  t.is(validate(schema, JSON.parse(JSON.stringify(generated))).result, 'pass')
})

test('can prefer defined type if present', (t) => {
  const schema: Validation = {
    root: 'string',
    aNumber: ['number'],
    mayBeUndefined: ['string', '?']
  }
  const generated = generate(schema, { prefer: 'defined' })
  t.is(typeof generated.root, 'string')
  t.is(typeof generated.aNumber, 'number')
  t.is(typeof generated.mayBeUndefined, 'string')
  const validated = validate(schema, generated)
  t.is(validated.result, 'pass')
  t.is(validate(schema, JSON.parse(JSON.stringify(generated))).result, 'pass')
})

test('Depth can be limited for recursive data structures', (t) => {
  const schema: Validation = {
    $types: { $tree: { value: 'string', left: ['?', '$tree'], right: ['?', '$tree'] } },
    root: '$tree'
  }
  // Set preference to defined values, to make sure that we have a large enough tree
  const layers3 = generate(schema, { prefer: 'defined', maxDepthSoft: 3 })
  // Observe that the tree is 3 objects deep
  t.truthy(layers3?.root?.left.left)
  t.is(layers3?.root?.left?.left?.left, undefined)

  const layers4 = generate(schema, { prefer: 'defined', maxDepthSoft: 4 })
  // Observe that the tree is 4 objects deep
  t.truthy(layers4?.root?.left?.left.left)
  t.is(layers4?.root?.left?.left?.left?.left, undefined)

  const validated = validate(schema, layers3)
  t.is(validated.result, 'pass')
  t.is(validate(schema, JSON.parse(JSON.stringify(layers3))).result, 'pass')
})

test('Depth for nested arrays can be limited', (t) => {
  const schema = {
    $types: { $tree: { value: 'string', nodes: { $array: '$tree' } } },
    $type: '$tree'
  }
  // Set preference to defined values, to make sure that we have a large enough tree
  const generated = generate(schema, { arrayMin: 1, maxDepthSoft: 3 })
  t.true(generated.nodes.length > 0)
  // Check that the final layer is an empty array
  t.is(generated.nodes.find((x: any) => x.nodes.find((y: any) => y.nodes.length !== 0)), undefined)
  const validated = validate(schema, generated)
  t.is(validated.result, 'pass')
})

test('Depth for nested maps can be limited', (t) => {
  const schema = {
    $types: { $tree: { value: 'string', nodes: { $map: '$tree' } } },
    $type: '$tree'
  }
  // Set preference to defined values, to make sure that we have a large enough tree
  const layers3 = generate(schema, { mapMin: 1, maxDepthSoft: 3 })
  t.true(Object.keys(layers3.nodes).length > 0)
  // Check that the final layer is an empty map
  t.is(Object.values(layers3.nodes).find((x: any) => Object.keys(x.nodes).length !== 0), undefined)
  const validated = validate(schema, layers3)
  t.is(validated.result, 'pass')
})

test('Schema with unescapable circular type will throw an error', (t) => {
  const schema = {
    $types: { $tree: { value: 'string', left: '$tree', right: '$tree' } },
    root: '$tree'
  }
  t.throws(() => generate(schema))
})

test('Can validate to multiple custom types with $and', (t) => {
  const schema: Validation = {
    $types: {
      $myObject: { value: 'string' },
      $otherObject: { num: 'number' },
      $myMetaObject: { $type: { value2: 'string' } }
    },
    $and: [{ valueA: 'string' }, '$myObject', '$myMetaObject', { $type: '$otherObject' }]
  }
  const generated = generate(schema)
  t.is(typeof generated.value, 'string')
  t.is(typeof generated.valueA, 'string')
  t.is(typeof generated.value2, 'string')
  t.is(typeof generated.num, 'number')
  const validated = validate(schema, generated)
  t.is(validated.result, 'pass')
})

test('invalid $and throws', (t) => {
  const schema: Validation = { $and: [{ valueA: 'string' }, 'myObject'] }
  t.throws(() => generate(schema))
})

test('Will limit array size to be between bounds', (t) => {
  const schema: Validation = { $array: 'string', minLength: 2, maxLength: 6 }
  for (let i = 0; i < 32; i++) {
    const generated = generate(schema)
    t.is(validate(schema, generated).result, 'pass')
  }
})

test('Will limit map size to be between bounds', (t) => {
  const schema: Validation = { $map: 'string', minLength: 2, maxLength: 6 }
  for (let i = 0; i < 32; i++) {
    const generated = generate(schema)
    t.is(validate(schema, generated).result, 'pass')
  }
})

test('Can specify types for some keys in map', (t) => {
  const schema = { $map: 'string', keySpecificType: { a: 'number' } }
  const generated = generate(schema)
  t.is(validate(schema, generated).result, 'pass')
})

const loadAndAddTestsBasedOnJsonDefinitions = (): void => {
  const testJsonFolder = './src/tests'
  const dirs = fs.readdirSync(testJsonFolder)

  dirs.forEach(x => {
    if (x.endsWith('json')) {
      const file = fs.readFileSync(path.join(testJsonFolder, x), 'utf-8')
      const json = JSON.parse(file)
      json.forEach((element: any, i: number) => {
        const indexName = element.name ? ` ${element.name}` : json.length > 1 ? ` > ${i}` : ''

        if (element.schema) {
          // const validData = element.validData || []
          // const invalidData = element.invalidData || []
          if (element.name === 'Keys specified deeper than the 2 levels are only checked at runtime (for now)') {
            // TODO
            return // This is a temporary mesaure. It shows and invalid schema that cannot be checked without running a validation through it.
          }

          // Run each test 4 times due to the random nature of tests, all 4 should pass
          for (let i = 0; i < 4; i++) {
            test(`${x}${indexName} > generated data > ${i}`, (t) => {
              const generated = generate(element.schema)
              const validated = validate(element.schema, generated)
              t.is(validated.result, 'pass', JSON.stringify({ generated, validation: validated.output }, null, 2))
            })
          }
        }
      })
    }
  })
}

loadAndAddTestsBasedOnJsonDefinitions()

/*
it.skip('Can generate a valid schema, that can generate data that is valid to the schema', async (t) => {
  const example = loadJson(await file('./selfSchema.json', 'utf8'))
  expect.assertions(64)
  let generatedSchema
  let generated
  let validated
  try {
    for (let i = 0; i < 2; i++) {
      generatedSchema = generate(example)
      const validSchema = validate(example, generatedSchema)
      t.is(validSchema.result, 'pass')
      generated = generate(generatedSchema)
      validated = validate(generatedSchema, generated)
      t.is(validated.result, 'pass')
    }
  } catch (e) {
    console.error(e.message, generated, generatedSchema)
    if (validated?.result === 'fail') {
      console.error(validated.output)
    }
  }
})

it.skip('Can generate a valid schema based on the schema definition', async () => {
  const example = loadJson(await file('./selfSchema.json', 'utf8'))
  expect.assertions(32)
  for (let i = 0; i < 2; i++) {
    const generated = generate(example)
    const validated = validate(example, generated)
    t.is(validated.result, 'pass')
  }
})
*/
