import { combineValidationObjects } from './validate.js'
import {
  Validation, isArray, isEnum, isObj,
  isString, isMap, isNumber, isTypeDefValidation, ValueTypes, isAnd, isLiteral, isTuple, isKeyOf, isPropertyPath, isOneOf
} from './validationTypes.js'

const containsOptional = (input: Validation): boolean =>
  (Array.isArray(input) && input.some(y => y === '?')) ||
  input === '?'

const allOptional = (input: Validation): boolean =>
  Object.values(input).every(containsOptional)

const simpleTypes = (input: string): 'string' | 'boolean' | 'number' | 'null' | 'any' | 'undefined' => {
  switch (input) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'any':
      return 'any'
    case 'null':
      return 'null'
    case '?':
      return 'undefined'
    default: throw new Error(`Unhandled ${input}`)
  }
}
export const validationToType = (input: ValueTypes): string => validationToTypeInternal(input, {})

const maxDepth = 32

const validationToTypeInternal = (input: ValueTypes, typesIn: { [key: string]: Validation }, depth: number = 0): string => {
  let customTypes = typesIn
  let type: ValueTypes = input
  if (isTypeDefValidation(input)) {
    customTypes = input.$types
    type = { ...input }
    delete type.$types
  }

  const toType = (input: ValueTypes): string => validationToTypeInternal(input, customTypes, depth + 1)
  if (depth > maxDepth) return 'any' // Bail out with any for recursive types
  if (Array.isArray(type)) { return type.map(toType).join(' | ') }
  if (isOneOf(type)) { return type.$oneOf.map(toType).join(' | ') }

  if (typeof type === 'string') {
    if (customTypes[type]) {
      return toType(customTypes[type])
    }

    return simpleTypes(type)
  }

  if (isArray(type)) {
    const typeRet = toType(type.$array)
    return (Array.isArray(type.$array) && type.$array.length > 1) || typeRet.includes('|')
      ? `(${typeRet})[]`
      : `${typeRet}[]`
  }

  if (isEnum(type) && Array.isArray(type.$enum)) { return type.$enum.map(x => `"${x}"`).join(' | ') }

  if (isObj(type)) {
    const optionalPostfix = (value: Validation): ('?' | '') => containsOptional(value) ? '?' : ''

    const obj = Object.entries(type)
      .map(([key, value]) => `${key.startsWith('\\$') ? key.slice(1) : key}${optionalPostfix(value)}: ${toType(value)}`)
      .join('; ')
    if (allOptional(type)) { return `{ ${obj} } | undefined` }

    return `{ ${obj} }`
  }

  if (isString(type)) { return toType('string') }

  if (isMap(type)) {
    let objType = ''
    if (type.keySpecificType) {
      objType = toType(type.keySpecificType)
    }
    return `{ [key: string] : ${toType(type.$map)}}${objType ? ' & ' + objType : ''}`
  }

  if (isNumber(type)) { return toType('number') }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, { root: {}, custom: customTypes }, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return toType(combined.pass)
  }

  if (isLiteral(type)) {
    return `"${type.$literal}"`
  }

  if (isTuple(type)) {
    return `[${type.$tuple.map(x => toType(x)).join(', ')}]`
  }

  if (isKeyOf(type)) {
    return 'string'
  }

  if (isPropertyPath(type)) {
    return 'string'
  }

  throw new Error(`UNSUPPORTED ${JSON.stringify(type, undefined, 2)}`)
}
