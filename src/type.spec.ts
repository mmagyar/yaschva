import { validationToType } from './type.js'
import { Validation } from './validationTypes.js'

describe('Creates typescript type from a schema', () => {
  it('Generates simple types', () => {
    expect(validationToType('?')).toEqual('undefined')
    expect(validationToType('null')).toEqual('null')
    expect(validationToType('any')).toEqual('any')
    expect(validationToType('boolean')).toEqual('boolean')
    expect(validationToType('number')).toEqual('number')
    expect(validationToType('integer')).toEqual('number')
    expect(validationToType('string')).toEqual('string')
  })

  it('Generates union types', () => {
    expect(validationToType(['?', 'boolean'])).toEqual('undefined | boolean')
    expect(validationToType(['any', 'number'])).toEqual('any | number')
    expect(validationToType(['integer', 'boolean', 'string', '?']))
      .toEqual('number | boolean | string | undefined')
  })

  it('Generates object of simple types', () => {
    const schema: Validation = {
      string: 'string',
      number: 'number',
      any: 'any',
      optional: '?',
      boolean: 'boolean',
      integer: 'integer'
    }
    expect(validationToType(schema))
      .toEqual('{ string: string; number: number; any: any;' +
        ' optional?: undefined; boolean: boolean; integer: number }')

    expect(validationToType({
      name: 'object with name',
      $type: { str: 'string', num: 'number' }
    })).toEqual('{ str: string; num: number }')
  })
  it('Generates type for arrays', () => {
    const schema: Validation = {
      stringOrNumber: { $array: ['string', 'number'] },
      objArray: { $array: { hello: 'string', world: 'number' } }
    }
    expect(validationToType(schema))
      .toEqual('{ stringOrNumber: (string | number)[];' +
      ' objArray: { hello: string; world: number }[] }')
  })

  it('Generates type for enum', () => {
    expect(validationToType({ $enum: ['lorem', 'ipsum', 'santa', 'domine'] }))
      .toEqual('"lorem" | "ipsum" | "santa" | "domine"')
  })

  it('Generates type for array ofenum', () => {
    expect(validationToType({ $array: { $enum: ['lorem', 'ipsum', 'santa', 'domine'] } }))
      .toEqual('("lorem" | "ipsum" | "santa" | "domine")[]')
  })

  it('Generates type for objects with undefined union if all members are optional', () => {
    const schema: Validation = {
      prop1: ['?', 'string'],
      prop2: ['?', 'number']
    }
    expect(validationToType(schema))
      .toEqual('{ prop1?: undefined | string; prop2?: undefined | number } | undefined')
  })

  it('Does not keep string length constraints in type', () => {
    expect(validationToType({ $string: { minLength: 4, maxLength: 16 } })).toEqual('string')
  })

  it('Does not keep number min/max constraints in type', () => {
    expect(validationToType({ $number: { min: 3, max: 9 } })).toEqual('number')
  })

  it('Generates type for key value pairs (map)', () => {
    expect(validationToType({ $map: 'number' })).toEqual('{ [key: string] : number}')
    expect(validationToType({ $map: ['number', 'string'] }))
      .toEqual('{ [key: string] : number | string}')

    expect(validationToType({ $map: ['number', { $array: ['string', '?'] }] }))
      .toEqual('{ [key: string] : number | (string | undefined)[]}')
  })

  it('Generates types based on custom type', () => {
    const schema: Validation = {
      $types: { $person: { name: 'string', height: 'number' } },
      string: 'string',
      person: '$person',
      number: 'number'

    }
    expect(validationToType(schema))
      .toEqual('{ string: string; person: { name: string; height: number }; number: number }')
  })

  it('Throws on unknown type', () => {
    const test = () => {
      const schema: any = { $stringss: { minLength: 77 } }
      validationToType(schema)
    }

    expect(test).toThrowError()

    const test2 = () => {
      const schema: any = { something: 'magicRune' }
      validationToType(schema)
    }

    expect(test2).toThrowError()
  })
  it('$ sign can be escaped in the schema and used for data key', () => {
    const validated = validationToType({ myNumber: 'number', '\\$escapedDollar': 'string' })
    expect(validated).toEqual('{ myNumber: number; $escapedDollar: string }')
  })

  it('Root can be a meta type', () => {
    const validated = validationToType({ $type: { $array: 'string' } })
    expect(validated).toBe('string[]')
  })

  it.skip('Can generate type for recursive data structure', () => {
    /// THIS DOES NOT WORK YET
    const schema:Validation = {
      $types: { $tree: { value: 'string', left: ['?', '$tree'], right: ['?', '$tree'] } },
      root: '$tree'
    }
    const type = validationToType(schema)
    console.log(type)
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
    const type = validationToType(schema)
    expect(type).toBe('{ valueA: string; value: string; value2: string; num: number }')
  })

  it('invalid $and throws', () => {
    const schema:Validation = { $and: [{ valueA: 'string' }, 'myObject'] }
    expect(() => validationToType(schema)).toThrowError()
  })
})
