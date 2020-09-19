import {
  Validation, isSimpleType, isArray, isEnum,
  isObj, isMap, isNumber, isMeta, isAnd,
  isString, SimpleTypes, isTypeDefValidation, ValueTypes
} from './validationTypes.js'
import { combineValidationObjects } from './validate.js'
import randexp from 'randexp'
type Options = {
  arrayMin: number
  arrayMax: number
  mapMin: number
  mapMax: number
  minNumber: number
  maxNumber: number
  minStringLength: number
  maxStringLength: number
  maxDepthSoft: number
  maxDepthHard: number
  prefer: 'defined' | 'undefined' | 'none'
  absoluteMaxStringSize: number
}

const saneMaximumSize = 12
export const randomNumber = (isInteger:boolean, c1: number, c2: number): number => {
  const min = Math.min(c1, c2)
  const max = Math.max(c1, c2)
  const num = Math.random() * (max - min) + min
  if (isInteger) return Math.round(num)
  return num
}

const simpleTypes: SimpleTypes[] = ['number', 'integer', '?', 'string', 'boolean']
const randomString = (options: Options, lengthIn?: number) => {
  const length = lengthIn ||
   randomNumber(true, options.minStringLength, options.maxStringLength)

  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  const max = Math.min(length, options.absoluteMaxStringSize)
  for (let i = 0; i < max; i += 1) { result += characters.charAt(Math.floor(Math.random() * charactersLength)) }

  return result
}
const simpleGeneration = (type: SimpleTypes, options:Options): any => {
  switch (type) {
    case 'any': return simpleGeneration(simpleTypes[randomNumber(true, 0, simpleTypes.length - 1)], options)
    case '?': return undefined
    case 'null': return null
    case 'number': return randomNumber(false, options.minNumber, options.maxNumber)
    case 'integer': return randomNumber(true, options.minNumber, options.maxNumber)
    case 'string': return randomString(options)
    case 'boolean': return Math.random() > 0.5
    default: throw new Error(`Unknown validator:${JSON.stringify(type)}`)
  }
}

const applyPreference = (input: Validation[], options:Options) => {
  if (options.prefer === 'defined') {
    return input.length > 1 ? input.filter(x => x !== '?') : input
  }
  if (options.prefer === 'undefined') {
    return input.find(x => x === '?') ? ['?'] : input
  }
  return input
}

export const generate = (type: Validation, options: Partial<Options> = {}) :any => {
  const defaultOptions : Options = {
    arrayMin: 1,
    arrayMax: 16,
    mapMin: 1,
    mapMax: 16,
    minNumber: -Number.MAX_SAFE_INTEGER,
    maxNumber: Number.MAX_SAFE_INTEGER,
    minStringLength: 3,
    maxStringLength: 16,
    maxDepthSoft: 4,
    maxDepthHard: 32,
    prefer: 'none',
    absoluteMaxStringSize: 8192
  }
  return generateInternal(type, { ...defaultOptions, ...options }, {}, 0, type)
}

const generateInternal = (
  typeIn: Validation,
  options: Options,
  typesIn: {[key:string] : Validation },
  depth :number,
  rootType: Validation
): any => {
  if (depth >= options.maxDepthHard) {
    throw new Error(`Maximum depth reached: ${depth} --
  Most likely a circular type with no possible way to terminate.
  Consider making the recursion optional.`)
  }

  let customTypes = typesIn
  let type:ValueTypes = typeIn
  if (isTypeDefValidation(typeIn)) {
    customTypes = typeIn.$types
    type = { ...typeIn }
    delete type.$types
  }

  const gen = (type:Validation, increaseDepth:boolean = false) =>
    generateInternal(type, options, customTypes, increaseDepth ? depth + 1 : depth, rootType)

  if (isSimpleType(type)) {
    if (customTypes[type]) {
      return gen(customTypes[type])
    }

    return simpleGeneration(type, options)
  }

  if (Array.isArray(type)) {
    if (depth > options.maxDepthSoft && type.find(x => x === '?')) {
      return simpleGeneration('?', options)
    } else {
      const typeArray = applyPreference(type, options)
      const randomIndex = randomNumber(true, 0, typeArray.length - 1)
      return gen(typeArray[randomIndex])
    }
  }

  if (isArray(type)) {
    const arrayType = type
    if (depth > options.maxDepthSoft && !arrayType.minLength) return []
    const min = typeof arrayType.minLength === 'number' ? arrayType.minLength : options.arrayMin
    const max = Math.min(
      typeof arrayType.maxLength === 'number' ? arrayType.maxLength : options.arrayMax,
      saneMaximumSize)
    return Array.from(Array(randomNumber(true, Math.min(min, max), max)))
      .map(() => gen(arrayType.$array, true)).filter(x => typeof x !== 'undefined')
  }

  if (isEnum(type)) { return type.$enum[randomNumber(true, 0, type.$enum.length - 1)] }

  if (isObj(type)) {
    return Object.entries(type).reduce((prev: any, [key, value]) => {
      let val:any | Validation = value
      // This is strictly needed to generate a schema that makes sense
      const num = { $number: { min: 0, max: 16, integer: true } }
      if ((key === 'minLength' || key === 'maxLength') && (value === 'number')) {
        val = num
      }
      if ((key === 'minLength' || key === 'maxLength') && (value as any).$number) {
        val = { $number: { ...(value as any).$number, ...num.$number } }
      }
      if ((key === 'minLength' || key === 'maxLength') &&
        Array.isArray(value) && value.some((x:any) => x.$number)) {
        val = value.map((x:any) => x.$number ? { $number: { ...x.$number, ...num.$number } } : x)
      }

      const generated = gen(val, true)
      const keyC = key.startsWith('\\$') ? key.slice(1) : key
      if (typeof generated !== 'undefined') prev[keyC] = generated
      return prev
    }, {})
  }

  if (isMap(type)) {
    const mapType = type
    const min = typeof mapType.minLength === 'number' ? mapType.minLength : options.mapMin
    const max = Math.min(
      typeof mapType.maxLength === 'number' ? mapType.maxLength : options.mapMax,
      saneMaximumSize)
    if (depth >= options.maxDepthSoft && !mapType.minLength) return {}
    const count = randomNumber(true, min, max)
    if (min <= 0 || max > 64) {
      throw new Error(`Too big, too small, size does matter after all, ${count}, min: ${min}, max: ${max}`)
    }
    const specKey = mapType.keySpecificType || {}
    return Array.from(Array(count))
      .reduce((prev: any) => {
        const specKeys = Object.keys(specKey)
        if (specKeys.length) {
          const key = specKeys[0].startsWith('\\$') ? specKeys[0].slice(1) : specKeys[0]
          prev[key] = gen(specKey[specKeys[0]], true)
        }
        const str = mapType.regex ? randexp.randexp(mapType.regex) : simpleGeneration('string', options)
        prev[str] = gen(mapType.$map, true)
        return prev
      }, {})
  }

  if (isNumber(type)) {
    return randomNumber(
      type.$number.integer || false,
      type.$number.min == null ? options.minNumber : type.$number.min,
      type.$number.max == null ? options.maxNumber : type.$number.max)
  }

  if (isMeta(type)) { return gen(type.$type) }

  if (isString(type)) {
    if (type.$string.regex) {
      const types = Object.keys((rootType as any)?.$types || {})
      if (type.$string.regex === '^\\$([a-zA-Z0-9_]{1,128})$' && types.length) {
        const i = randomNumber(true, 0, types.length)
        return types[i]
      } else {
        const regexString = randexp.randexp(type.$string.regex)
        return regexString
      }
    }

    return randomString(options, type.$string.minLength || type.$string.maxLength)
  }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, customTypes, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return gen(combined.pass)
  }

  throw new Error('Unknown type: ' + JSON.stringify(typeIn, null, 2))
}
