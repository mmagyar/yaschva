import { combineValidationObjects } from './validate.js'
import {
  Validation, isArray, isEnum, isObj,
  isString, isMap, isNumber, isTypeDefValidation, ValueTypes, isMeta, isAnd
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

  if (isEnum(type) && Array.isArray(type.$enum)) { return type.$enum.map(x => `"${x}"`).join(' | ') }
  if (isEnum(type)) { return '' /** TODO **/ }

  if (isObj(type)) {
    const optionalPostfix = (value: Validation) => containsOptional(value) ? '?' : ''

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

  if (isMeta(type)) { return toType(type.$type) }

  if (isNumber(type)) { return toType('number') }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, { root: {}, custom: customTypes }, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return toType(combined.pass)
  }

  throw new Error(`UNSUPPORTED ${JSON.stringify(type, undefined, 2)}`)
}
