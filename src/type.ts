import {
  ValueType, Validation, isArray, isEnum, isObj,
  isString, isMap, isObjectMeta, isNumber
} from './validationTypes'

const containsOptional = (input: Validation) =>
  (Array.isArray(input) && input.some(y => y === '?')) ||
   input === '?'

const allOptional = (input: Validation) =>
  Object.values(input).every(containsOptional)

const simpleTypes = (input: string) => {
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
    case '?':
      return 'undefined'
    default: throw new Error(`Unhandled ${input}`)
  }
}

export const validationToType = (input: ValueType | ValueType[]): string => {
  if (Array.isArray(input)) { return input.map(validationToType).join(' | ') }

  if (typeof input === 'string') { return simpleTypes(input) }

  if (isArray(input)) {
    const type = validationToType(input.$array)
    return (Array.isArray(input.$array) && input.$array.length > 1) || type.indexOf('|') > -1
      ? `(${type})[]` : `${type}[]`
  }

  if (isEnum(input)) { return input.$enum.map(x => `"${x}"`).join(' | ') }

  if (isObj(input)) {
    const optionalPostfix = (value: Validation) => containsOptional(value) ? '?' : ''

    const obj = Object.entries(input)
      .map(([key, value]) => `${key}${optionalPostfix(value)}: ${validationToType(value)}`)
      .join('; ')
    if (allOptional(input)) { return `{ ${obj} } | undefined` }

    return `{ ${obj} }`
  }

  if (isString(input)) { return validationToType('string') }

  if (isMap(input)) { return `{ [key: string] : ${validationToType(input.$map)}}` }

  if (isObjectMeta(input)) { return validationToType(input.$object) }

  if (isNumber(input)) { return validationToType('number') }

  throw new Error(`UNSUPPORTED ${JSON.stringify(input, undefined, 2)}`)
}
