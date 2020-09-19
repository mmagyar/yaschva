import { Validation } from './validationTypes.js'
import { generate, randomNumber } from './generate.js'
import { loadJson, validate } from './validate.js'
import fs from 'fs'
import { inspect } from 'util'
inspect.defaultOptions.depth = null

const file = fs.promises.readFile
describe('generates data based on schema', () => {
  const checkNumber = (result: number) => {
    expect(result).not.toEqual(Infinity)
    expect(result).not.toBeNaN()
    expect(typeof result).toEqual('number')
  }
  it('Generates a random number that is not infinity or NaN', () => {
    for (let i = 0; i < 32; i += 1) {
      checkNumber(randomNumber(false, 0, 100))
      const int = randomNumber(true, -10, 99)
      checkNumber(int)
      expect(Number.isSafeInteger(int)).toBeTruthy()
      expect(int).toBeGreaterThanOrEqual(-10)
      expect(int).toBeLessThanOrEqual(99)
    }
  })
  it('Generates simple types', () => {
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
      expect(typeof result.string).toEqual('string')
      expect(typeof result.number).toEqual('number')
      expect(typeof result.boolean).toEqual('boolean')
      expect(result.null).toStrictEqual(null)
      expect(Number.isSafeInteger(result.integer))
      if (result.any === undefined) anyGenerated.push(result.any)
      expect(result).not.toHaveProperty('optional')
      expect(result.optional).toBeUndefined()
      expect(validate(schema, result)).toHaveProperty('result', 'pass')
    }

    // Make sure any generates non undefined values as well
    expect(anyGenerated.length).toBeGreaterThan(0)
  })

  it('Generates on of multiple types', () => {
    const schema: Validation = {
      stringOrNumber: ['string', 'number'],
      optionalString: ['?', 'string']
    }
    const result = generate(schema)
    expect(typeof result.stringOrNumber === 'string' ||
      typeof result.stringOrNumber === 'number').toBeTruthy()
    expect(result.optionalString === undefined || typeof result.optionalString === 'string')
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('Generates arrays', () => {
    const schema: Validation = {
      stringOrNumber: { $array: ['string', 'number'] },
      objArray: { $array: { hello: 'string', world: 'number' } }
    }
    const result = generate(schema)
    expect(Array.isArray(result.stringOrNumber)).toBeTruthy()
    result.stringOrNumber
      .forEach((x: any) => expect(typeof x === 'string' || typeof x === 'number').toBeTruthy())

    expect(Array.isArray(result.objArray)).toBeTruthy()
    result.objArray
      .forEach((x: any) => {
        expect(typeof x === 'object' && x !== null).toBeTruthy()
        expect(typeof x.hello === 'string').toBeTruthy()
        expect(typeof x.world === 'number').toBeTruthy()
      })
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('Generates enum', () => {
    const enums = ['lolly', 'pop', 'chewingGum', 'doughnut']
    const schema: Validation = {
      enum: { $enum: enums }
    }
    const result = generate(schema)
    expect(enums.some(x => x === result.enum)).toBeTruthy()
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('Generates object meta', () => {
    const schema: Validation = {
      meta: {
        name: 'object with name',
        $type: { here: 'string' }
      }
    }
    const result = generate(schema)
    expect(result).toHaveProperty('meta')
    expect(result.meta).toHaveProperty('here')
    expect(typeof result.meta.here === 'string').toBeTruthy()
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('Generates map (key value pairs)', () => {
    const schema: Validation = {
      map: { $map: 'number' }
    }
    const result = generate(schema)
    expect(result).toHaveProperty('map')
    expect(typeof result.map === 'object' && result.map !== null).toBeTruthy()
    const values = Object.values(result.map)
    expect(values.length).toBeGreaterThanOrEqual(1)
    expect(values.length).toBeLessThanOrEqual(33)
    values.forEach(x => expect(typeof x === 'number').toBeTruthy())
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('Key value pair keys can be regex validated', () => {
    const schema: Validation = { $map: ['number'], regex: '^ab[a-z]' }
    const generated = generate(schema, { mapMin: 5 })
    expect(Object.keys(generated).length).toBeGreaterThan(1)
    expect(validate(schema, generated)).toHaveProperty('result', 'pass')
  })

  it('Generates bound number', () => {
    const schema: Validation = { $number: { min: 33, max: 45 } }
    const result = generate(schema)
    expect(result).toBeGreaterThanOrEqual(33)
    expect(result).toBeLessThanOrEqual(45)
  })

  it('Generates unbound number', () => {
    const schema: Validation = { $number: {} }
    const result = generate(schema)
    expect(typeof result).toBe('number')
  })

  it('Generates extended simple type', () => {
    const result = generate({ $type: 'string' })
    expect(typeof result === 'string').toBeTruthy()
  })

  it('Generates extended string', () => {
    const result = generate({ $string: { minLength: 77 } })
    expect(typeof result === 'string').toBeTruthy()
    expect(result.length >= 77).toBeTruthy()

    const result2 = generate({ $string: { maxLength: 33 } })
    expect(typeof result2 === 'string').toBeTruthy()
    expect(result2.length <= 33).toBeTruthy()

    expect(typeof generate({ $string: { } })).toBe('string')
  })

  it('Throws on unknown type', () => {
    const test = () => {
      const schema: any = { $stringss: { minLength: 77 } }
      generate(schema)
    }

    expect(test).toThrowError()

    const test2 = () => {
      const schema: any = { something: 'magicRune' }
      generate(schema)
    }

    expect(test2).toThrowError()
  })

  it('Generates example from parsed json', async () => {
    const a = loadJson(JSON.parse(await file('./examples/example1.json', 'utf8')))

    expect(validate(a, generate(a))).toHaveProperty('result', 'pass')
  })

  it('Generates example from string', async () => {
    const a = loadJson(await file('./examples/example1.json', 'utf8'))

    expect(validate(a, generate(a))).toHaveProperty('result', 'pass')
  })

  it('Generates string based on regex', () => {
    const result = generate({ $string: { regex: '\\b(\\w*work\\w*)\\b' } })
    expect(typeof result === 'string').toBeTruthy()
    expect(result.includes('work')).toBeTruthy()
  })

  it('Generates uuid based on regex', () => {
    const regex = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}'
    for (var i = 0; i < 240; i++) {
      const result = generate({ id: { $string: { regex } } })
      expect(typeof result.id).toBe('string')
    }
  })

  it('Does not add property to object if it\'s optionally undefined', () => {
    const undefinedGenerated = []
    for (var i = 0; i < 240; i++) {
      const result = generate({ value: ['string', '?'] })
      if (Object.keys(result).indexOf('value') !== -1) {
        expect(typeof result.value).toBe('string')
      } else {
        expect(Object.keys(result)).toHaveLength(0)
        undefinedGenerated.push(result)
      }
    }
    expect(undefinedGenerated.length).toBeGreaterThan(0)
  })

  it('$ sign can be escaped in the schema and used for data key', () => {
    const validated = generate({ myNumber: 'number', '\\$escapedDollar': 'string' })
    expect(validated).toHaveProperty('myNumber')
    expect(validated).toHaveProperty('$escapedDollar')
  })

  it('Generates empty array for array of undefined', () => {
    const schema = { $array: '?' }
    const generated = generate(schema)
    const validated = validate(schema, generated)
    expect(validated).toHaveProperty('result', 'pass')
    expect(validate(schema, JSON.parse(JSON.stringify(generated)))).toHaveProperty('result', 'pass')
  })

  it('Can prefer undefined type if present', () => {
    const schema : Validation = {
      root: 'string',
      aNumber: ['number'],
      mayBeUndefined: ['string', '?']
    }
    const generated = generate(schema, { prefer: 'undefined' })
    expect(typeof generated.root).toBe('string')
    expect(typeof generated.aNumber).toBe('number')
    expect(typeof generated.mayBeUndefined).toBe('undefined')
    const validated = validate(schema, generated)
    expect(validated).toHaveProperty('result', 'pass')
    expect(validate(schema, JSON.parse(JSON.stringify(generated)))).toHaveProperty('result', 'pass')
  })

  it('can prefer defined type if present', () => {
    const schema :Validation = {
      root: 'string',
      aNumber: ['number'],
      mayBeUndefined: ['string', '?']
    }
    const generated = generate(schema, { prefer: 'defined' })
    expect(typeof generated.root).toBe('string')
    expect(typeof generated.aNumber).toBe('number')
    expect(typeof generated.mayBeUndefined).toBe('string')
    const validated = validate(schema, generated)
    expect(validated).toHaveProperty('result', 'pass')
    expect(validate(schema, JSON.parse(JSON.stringify(generated)))).toHaveProperty('result', 'pass')
  })

  it('Depth can be limited for recursive data structures', () => {
    const schema: Validation = {
      $types: { $tree: { value: 'string', left: ['?', '$tree'], right: ['?', '$tree'] } },
      root: '$tree'
    }
    // Set preference to defined values, to make sure that we have a large enough tree
    const layers3 = generate(schema, { prefer: 'defined', maxDepthSoft: 3 })
    // Observe that the tree is 3 objects deep
    expect(layers3?.root?.left).toHaveProperty('left')
    expect(layers3?.root?.left?.left).not.toHaveProperty('left')

    const layers4 = generate(schema, { prefer: 'defined', maxDepthSoft: 4 })
    // Observe that the tree is 4 objects deep
    expect(layers4?.root?.left?.left).toHaveProperty('left')
    expect(layers4?.root?.left?.left?.left).not.toHaveProperty('left')

    const validated = validate(schema, layers3)
    expect(validated).toHaveProperty('result', 'pass')
    expect(validate(schema, JSON.parse(JSON.stringify(layers3)))).toHaveProperty('result', 'pass')
  })

  it('Depth for nested arrays can be limited', () => {
    const schema = {
      $types: { $tree: { value: 'string', nodes: { $array: '$tree' } } },
      $type: '$tree'
    }
    // Set preference to defined values, to make sure that we have a large enough tree
    const generated = generate(schema, { arrayMin: 1, maxDepthSoft: 3 })
    expect(generated.nodes.length).toBeGreaterThan(0)
    // Check that the final layer is an empty array
    expect(generated.nodes.find((x:any) => x.nodes.find((y:any) => y.nodes.length !== 0))).toBeUndefined()
    const validated = validate(schema, generated)
    expect(validated).toHaveProperty('result', 'pass')
  })

  it('Depth for nested maps can be limited', () => {
    const schema = {
      $types: { $tree: { value: 'string', nodes: { $map: '$tree' } } },
      $type: '$tree'
    }
    // Set preference to defined values, to make sure that we have a large enough tree
    const layers3 = generate(schema, { mapMin: 1, maxDepthSoft: 3 })
    expect(Object.keys(layers3.nodes).length).toBeGreaterThan(0)
    // Check that the final layer is an empty map
    expect(Object.values(layers3.nodes).find((x:any) => Object.keys(x.nodes).length !== 0)).toBeUndefined()
    const validated = validate(schema, layers3)
    expect(validated).toHaveProperty('result', 'pass')
  })

  it('Schema with unescapable circular type will throw an error', () => {
    const schema = {
      $types: { $tree: { value: 'string', left: '$tree', right: '$tree' } },
      root: '$tree'
    }
    expect(() => generate(schema)).toThrowError()
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
    const generated = generate(schema)
    expect(typeof generated.value).toBe('string')
    expect(typeof generated.valueA).toBe('string')
    expect(typeof generated.value2).toBe('string')
    expect(typeof generated.num).toBe('number')
    const validated = validate(schema, generated)
    expect(validated).toHaveProperty('result', 'pass')
  })

  it('invalid $and throws', () => {
    const schema:Validation = { $and: [{ valueA: 'string' }, 'myObject'] }
    expect(() => generate(schema)).toThrowError()
  })

  it('Will limit array size to be between bounds', () => {
    const schema :Validation = { $array: 'string', minLength: 2, maxLength: 6 }
    for (let i = 0; i < 32; i++) {
      const generated = generate(schema)
      expect(validate(schema, generated)).toHaveProperty('result', 'pass')
    }
  })

  it('Will limit map size to be between bounds', () => {
    const schema :Validation = { $map: 'string', minLength: 2, maxLength: 6 }
    for (let i = 0; i < 32; i++) {
      const generated = generate(schema)
      expect(validate(schema, generated)).toHaveProperty('result', 'pass')
    }
  })

  it('Can specify types for some keys in map', () => {
    const schema = { $map: 'string', keySpecificType: { a: 'number' } }
    const generated = generate(schema)
    expect(validate(schema, generated)).toHaveProperty('result', 'pass')
  })

  it.skip('Can generate a valid schema, that can generate data that is valid to the schema', async () => {
    const example = loadJson(await file('./selfSchema.json', 'utf8'))
    expect.assertions(64)
    let generatedSchema
    let generated
    let validated
    try {
      for (let i = 0; i < 2; i++) {
        generatedSchema = generate(example)
        const validSchema = validate(example, generatedSchema)
        expect(validSchema).toHaveProperty('result', 'pass')
        generated = generate(generatedSchema)
        validated = validate(generatedSchema, generated)
        expect(validated).toHaveProperty('result', 'pass')
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
      expect(validated).toHaveProperty('result', 'pass')
    }
  })
})
