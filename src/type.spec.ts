import test from 'ava'
import fs from 'fs'
import path from 'path'
import { validationToType } from './type.js'
import { Validation } from './validationTypes.js'

test('Generates simple types', (t) => {
  t.is(validationToType('?'), 'undefined')
  t.is(validationToType('null'), 'null')
  t.is(validationToType('any'), 'any')
  t.is(validationToType('boolean'), 'boolean')
  t.is(validationToType('number'), 'number')
  t.is(validationToType('integer'), 'number')
  t.is(validationToType('string'), 'string')
})

test('Generates union types', (t) => {
  t.is(validationToType(['?', 'boolean']), 'undefined | boolean')
  t.is(validationToType(['any', 'number']), 'any | number')
  t.is(validationToType(['integer', 'boolean', 'string', '?']), 'number | boolean | string | undefined')
})

test('Generates object of simple types', (t) => {
  const schema: Validation = {
    string: 'string',
    number: 'number',
    any: 'any',
    optional: '?',
    boolean: 'boolean',
    integer: 'integer'
  }
  t.is(validationToType(schema), '{ string: string; number: number; any: any;' +
        ' optional?: undefined; boolean: boolean; integer: number }')
})
test('Generates type for arrays', (t) => {
  const schema: Validation = {
    stringOrNumber: { $array: ['string', 'number'] },
    objArray: { $array: { hello: 'string', world: 'number' } }
  }
  t.is(validationToType(schema), '{ stringOrNumber: (string | number)[];' +
      ' objArray: { hello: string; world: number }[] }')
})

test('Generates type for enum', (t) => {
  t.is(validationToType({ $enum: ['lorem', 'ipsum', 'santa', 'domine'] }), '"lorem" | "ipsum" | "santa" | "domine"')
})

test('Generates type for array ofenum', (t) => {
  t.is(validationToType({ $array: { $enum: ['lorem', 'ipsum', 'santa', 'domine'] } }), '("lorem" | "ipsum" | "santa" | "domine")[]')
})

test('Generates type for objects with undefined union if all members are optional', (t) => {
  const schema: Validation = {
    prop1: ['?', 'string'],
    prop2: ['?', 'number']
  }
  t.is(validationToType(schema), '{ prop1?: undefined | string; prop2?: undefined | number } | undefined')
})

test('Does not keep string length constraints in type', (t) => {
  t.is(validationToType({ $string: { minLength: 4, maxLength: 16 } }), 'string')
})

test('Does not keep number min/max constraints in type', (t) => {
  t.is(validationToType({ $number: { min: 3, max: 9 } }), 'number')
})

test('Generates type for key value pairs (map)', (t) => {
  t.is(validationToType({ $map: 'number' }), '{ [key: string] : number}')
  t.is(validationToType({ $map: ['number', 'string'] }), '{ [key: string] : number | string}')

  t.is(validationToType({ $map: ['number', { $array: ['string', '?'] }] }), '{ [key: string] : number | (string | undefined)[]}')
})

test('Generates types based on custom type', (t) => {
  const schema: Validation = {
    $types: { $person: { name: 'string', height: 'number' } },
    string: 'string',
    person: '$person',
    number: 'number'

  }
  t.is(validationToType(schema),
    '{ string: string; person: { name: string; height: number }; number: number }')
})

test('Throws on unknown type', (t) => {
  const test = (): void => {
    const schema: any = { $stringss: { minLength: 77 } }
    validationToType(schema)
  }

  t.throws(test)

  const test2 = (): void => {
    const schema: any = { something: 'magicRune' }
    validationToType(schema)
  }

  t.throws(test2)
})
test('$ sign can be escaped in the schema and used for data key', (t) => {
  const validated = validationToType({ myNumber: 'number', '\\$escapedDollar': 'string' })
  t.is(validated, '{ myNumber: number; $escapedDollar: string }')
})

test('Generate literal type', (t) => {
  const schema = { literalProp: { $literal: 'doge' } }
  const type = validationToType(schema)
  t.is(type, '{ literalProp: "doge" }')
})

test('Generate tuple type', (t) => {
  const schema: Validation = { tupleProp: { $tuple: ['string', 'number', { innerObject: 'number' }] } }
  const type = validationToType(schema)
  t.is(type, '{ tupleProp: [string, number, { innerObject: number }] }')
})

// This should change to using actual keyOf, if possible
test('Generate keyof type as string', (t) => {
  const schema: Validation = { keyOfProp: { $keyOf: 'string' } }
  const type = validationToType(schema)
  t.is(type, '{ keyOfProp: string }')
})

test('recursive data structre will devolve into any after a pre set depth', (t) => {
  const schema: Validation = {
    $types: { $tree: { value: 'string', left: ['?', '$tree'], right: ['?', '$tree'] } },
    root: '$tree'
  }
  const type = validationToType(schema)
  t.is(typeof type, 'string')
})

test('Can validate to multiple custom types with $and', (t) => {
  const schema: Validation = {
    $types: {
      $myObject: { value: 'string' },
      $otherObject: { num: 'number' },
      $myMetaObject: { value2: 'string' }
    },
    $and: [{ valueA: 'string' }, '$myObject', '$myMetaObject', '$otherObject']
  }
  const type = validationToType(schema)
  t.is(type, '{ valueA: string; value: string; value2: string; num: number }')
})

test('invalid $and throws', (t) => {
  const schema: Validation = { $and: [{ valueA: 'string' }, 'myObject'] }
  t.throws(() => validationToType(schema))
})

test('Can specify types for some keys in map', (t) => {
  const schema = { $map: 'string', keySpecificType: { a: 'number', x: 'string' } }
  t.is(validationToType(schema), '{ [key: string] : string} & { a: number; x: string }')
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
          // TODO
          // const validData = element.validData || []
          // const invalidData = element.invalidData || []
          if (element.name === 'Keys specified deeper than the 2 levels are only checked at runtime (for now)') {
            return // This is a temporary mesaure. It shows and invalid schema that cannot be checked without running a validation through it.
          }
          for (let i = 0; i < 1; i++) {
            test(`${x}${indexName} > type generation > ${i}`, (t) => {
              const validated = validationToType(element.schema)
              t.is(typeof validated, 'string', JSON.stringify(validated, null, 2))
            })
          }
        }
      })
    }
  })
}

loadAndAddTestsBasedOnJsonDefinitions()
