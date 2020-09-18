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
}

export const randomNumber = (isInteger:boolean, min: number, max: number): number => {
  const num = Math.random() * (max - min) + min
  if (isInteger) return Math.round(num)
  return num
}

const simpleTypes: SimpleTypes[] = ['number', 'integer', '?', 'string', 'boolean']
const randomString = (length: number) => {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i += 1) { result += characters.charAt(Math.floor(Math.random() * charactersLength)) }

  return result
}
const simpleGeneration = (type: SimpleTypes, options:Options): any => {
  switch (type) {
    case 'any': return simpleGeneration(simpleTypes[randomNumber(true, 0, simpleTypes.length - 1)], options)
    case '?': return undefined
    case 'null': return null
    case 'number': return randomNumber(false, options.minNumber, options.maxNumber)
    case 'integer': return randomNumber(true, options.minNumber, options.maxNumber)
    case 'string': return randomString(
      randomNumber(true, options.minStringLength, options.maxStringLength))
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
    arrayMax: 90,
    mapMin: 1,
    mapMax: 33,
    minNumber: -Number.MAX_SAFE_INTEGER,
    maxNumber: Number.MAX_SAFE_INTEGER,
    minStringLength: 3,
    maxStringLength: 16,
    maxDepthSoft: 4,
    maxDepthHard: 32,
    prefer: 'none'
  }
  return generateInternal(type, { ...defaultOptions, ...options }, {}, 0)
}

const generateInternal = (
  typeIn: Validation,
  options: Options,
  typesIn: {[key:string] : Validation },
  depth :number
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
    generateInternal(type, options, customTypes, increaseDepth ? depth + 1 : depth)

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
    if (depth > options.maxDepthSoft) return []
    return Array.from(Array(randomNumber(true, options.arrayMin, options.arrayMax)))
      .map(() => gen(arrayType.$array, true)).filter(x => typeof x !== 'undefined')
  }

  if (isEnum(type)) { return type.$enum[randomNumber(true, 0, type.$enum.length - 1)] }

  if (isObj(type)) {
    return Object.entries(type).reduce((prev: any, [key, value]) => {
      const generated = gen(value, true)
      const keyC = key.startsWith('\\$') ? key.slice(1) : key
      if (typeof generated !== 'undefined') prev[keyC] = generated
      return prev
    }, {})
  }

  if (isMap(type)) {
    const mapType = type
    if (depth >= options.maxDepthSoft) return {}
    const count = randomNumber(true, options.mapMin, options.mapMax)
    return Array.from(Array(count))
      .reduce((prev: any) => {
        const str = mapType.regex ? randexp.randexp(mapType.regex) : simpleGeneration('string', options)
        prev[str] = gen(mapType.$map, true)
        return prev
      }, {})
  }

  if (isNumber(type)) {
    return randomNumber(
      false,
      type.$number.min == null ? options.minNumber : type.$number.min,
      type.$number.max == null ? options.maxNumber : type.$number.max)
  }

  if (isMeta(type)) { return gen(type.$type) }

  if (isString(type)) {
    if (type.$string.regex) { return randexp.randexp(type.$string.regex) }

    return randomString(type.$string.minLength || type.$string.maxLength || 6)
  }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, customTypes, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return gen(combined.pass)
  }

  throw new Error('Unknown type')
}
