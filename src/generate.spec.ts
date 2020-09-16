import { Validation } from './validationTypes.js'
import { generate, randomNumber } from './generate.js'
import { loadJson, validate } from './validate.js'
import fs from 'fs'
const file = fs.promises.readFile
describe('It generates data based on schema', () => {
  const checkNumber = (result: number) => {
    expect(result).not.toEqual(Infinity)
    expect(result).not.toBeNaN()
    expect(typeof result).toEqual('number')
  }
  it('generates a random number that is not infinity or NaN', () => {
    for (let i = 0; i < 32; i += 1) {
      checkNumber(randomNumber())
      const int = randomNumber(true, -10, 99)
      checkNumber(int)
      expect(Number.isSafeInteger(int)).toBeTruthy()
      expect(int).toBeGreaterThanOrEqual(-10)
      expect(int).toBeLessThanOrEqual(99)
    }
  })
  it('generates simple types', () => {
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

  it('generates on of multiple types', () => {
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

  it('generates arrays', () => {
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

  it('generates enum', () => {
    const enums = ['lolly', 'pop', 'chewingGum', 'doughnut']
    const schema: Validation = {
      enum: { $enum: enums }
    }
    const result = generate(schema)
    expect(enums.some(x => x === result.enum)).toBeTruthy()
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('generates object meta', () => {
    const schema: Validation = {
      meta: { $object: { here: 'string' } }
    }
    const result = generate(schema)
    expect(result).toHaveProperty('meta')
    expect(result.meta).toHaveProperty('here')
    expect(typeof result.meta.here === 'string').toBeTruthy()
    expect(validate(schema, result)).toHaveProperty('result', 'pass')
  })

  it('generates map (key value pairs)', () => {
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

  it('generates bound number', () => {
    const schema: Validation = { $number: { min: 33, max: 45 } }
    const result = generate(schema)
    expect(result).toBeGreaterThanOrEqual(33)
    expect(result).toBeLessThanOrEqual(45)
  })

  it('generates extended simple type', () => {
    const result = generate({ $type: 'string' })
    expect(typeof result === 'string').toBeTruthy()
  })

  it('generates extended string', () => {
    const result = generate({ $string: { minLength: 77 } })
    expect(typeof result === 'string').toBeTruthy()
    expect(result.length >= 77).toBeTruthy()

    const result2 = generate({ $string: { maxLength: 33 } })
    expect(typeof result2 === 'string').toBeTruthy()
    expect(result2.length <= 33).toBeTruthy()

    expect(generate({ $string: { } })).toHaveLength(6)
  })

  it('throws on unknown type', () => {
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

  it('generates example from parsed json', async () => {
    const a = loadJson(JSON.parse(await file('./examples/example1.json', 'utf8')))

    expect(validate(a, generate(a))).toHaveProperty('result', 'pass')
  })

  it('generates example from string', async () => {
    const a = loadJson(await file('./examples/example1.json', 'utf8'))

    expect(validate(a, generate(a))).toHaveProperty('result', 'pass')
  })

  it('generates string based on regex', () => {
    const result = generate({ $string: { regex: '\\b(\\w*work\\w*)\\b' } })
    expect(typeof result === 'string').toBeTruthy()
    expect(result.includes('work')).toBeTruthy()
  })

  it('generates uuid based on regex', () => {
    const regex = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}'
    for (var i = 0; i < 240; i++) {
      const result = generate({ id: { $string: { regex } } })
      expect(typeof result.id).toBe('string')
    }
  })

  it('does not add property to object if it\'s optionally undefined', () => {
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

  it('generates empty array for array of undefined', () => {
    const schema = { $array: '?' }
    const generated = generate(schema)
    const validated = validate(schema, generated)
    expect(validated).toHaveProperty('result', 'pass')
    expect(validate(schema, JSON.parse(JSON.stringify(generated)))).toHaveProperty('result', 'pass')
  })
})
