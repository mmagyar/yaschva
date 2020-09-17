import {
  Validation, isArray, isEnum, isObj,
  isString, isMap, isObjectMeta, isNumber, isTypeDefValidation, ValueTypes, isMeta
} from './validationTypes.js'

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
    case 'null':
      return 'null'
    case '?':
      return 'undefined'
    default: throw new Error(`Unhandled ${input}`)
  }
}
export const validationToType = (input:ValueTypes): string => validationToTypeInternal(input, {})
const validationToTypeInternal = (input: ValueTypes, typesIn: {[key:string]:Validation}): string => {
  let customTypes = typesIn
  let type:ValueTypes = input
  if (isTypeDefValidation(input)) {
    customTypes = input.$types
    type = { ...input }
    delete type.$types
  }

  const toType = (input:ValueTypes) => validationToTypeInternal(input, customTypes)

  if (Array.isArray(type)) { return type.map(toType).join(' | ') }

  if (typeof type === 'string') {
    if (customTypes[type]) {
      return toType(customTypes[type])
    }

    return simpleTypes(type)
  }

  if (isArray(type)) {
    const typeRet = toType(type.$array)
    return (Array.isArray(type.$array) && type.$array.length > 1) || typeRet.indexOf('|') > -1
      ? `(${typeRet})[]` : `${typeRet}[]`
  }

  if (isEnum(type)) { return type.$enum.map(x => `"${x}"`).join(' | ') }

  if (isObj(type)) {
    const optionalPostfix = (value: Validation) => containsOptional(value) ? '?' : ''

    const obj = Object.entries(type)
      .map(([key, value]) => `${key.startsWith('\\$') ? key.slice(1) : key}${optionalPostfix(value)}: ${toType(value)}`)
      .join('; ')
    if (allOptional(type)) { return `{ ${obj} } | undefined` }

    return `{ ${obj} }`
  }

  if (isString(type)) { return toType('string') }

  if (isMap(type)) { return `{ [key: string] : ${toType(type.$map)}}` }

  if (isObjectMeta(type)) { return toType(type.$object) }

  if (isMeta(type)) { return toType(type.$type) }

  if (isNumber(type)) { return toType('number') }

  throw new Error(`UNSUPPORTED ${JSON.stringify(type, undefined, 2)}`)
}
