import randexp from 'randexp'
import { combineValidationObjects } from '../validate.js'
import { Validation, ValueTypes, isTypeDefValidation, isSimpleType, isEnum, isKeyOf, isPropertyPath, isObj, isMap, isMeta, isAnd, isLiteral, isTuple, SimpleTypes, isArray, isNumber, isString, ValueType } from '../validationTypes.js'
import { Options } from './config.js'
import { getMinimumDepth } from './info.js'
import { generatePropertyPath, randomNumber, randomString } from './random.js'

const saneMaximumSize = 12

const simpleTypes: SimpleTypes[] = ['number', 'integer', '?', 'string', 'boolean']
const simpleGeneration = (type: SimpleTypes, options: Options): any => {
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

const applyPreference = (input: Validation[], options: Options): Validation[] => {
  if (options.prefer === 'defined') {
    return input.length > 1 ? input.filter(x => x !== '?') : input
  }
  if (options.prefer === 'undefined') {
    return input.find(x => x === '?') ? ['?'] : input
  }
  return input
}

export const generateInternal = (
  typeIn: Validation,
  options: Options,
  typesIn: { [key: string]: Validation },
  depth: number,
  rootType: Validation
): any => {
  if (depth >= options.maxDepthHard) {
    throw new Error(`Maximum depth reached: ${depth} --
  Most likely a circular type with no possible way to terminate.
  Consider making the recursion optional.`)
  }

  let customTypes = typesIn
  let type: ValueTypes = typeIn
  if (isTypeDefValidation(typeIn)) {
    customTypes = typeIn.$types
    type = { ...typeIn }
    delete type.$types
  }

  const gen = (type: Validation, increaseDepth: boolean = false): any =>
    generateInternal(type, options, customTypes, increaseDepth ? depth + 1 : depth, rootType)

  if (isSimpleType(type)) {
    if (customTypes[type]) {
      return gen(customTypes[type])
    }

    return simpleGeneration(type, options)
  }

  if (Array.isArray(type)) {
    if (depth > options.maxDepthSoft) {
      if (type.find(x => x === '?')) { return simpleGeneration('?', options) }
      let leastDepth: {depth: number, type: ValueType} | undefined
      for (const currentType of type) {
        const minDepth = getMinimumDepth(currentType, customTypes)
        if (minDepth < 1) return gen(currentType)
        if (!leastDepth) leastDepth = { depth: minDepth, type: currentType }
        else if (leastDepth.depth > minDepth) {
          leastDepth = { depth: minDepth, type: currentType }
        }
      }
      return gen(leastDepth ? leastDepth.type : type[0])
    } else {
      const typeArray = applyPreference(type, options)
      const randomIndex = randomNumber(true, 0, typeArray.length - 1)
      return gen(typeArray[randomIndex])
    }
  }

  if (isArray(type)) {
    const arrayType = type
    if (depth > options.maxDepthSoft) {
      if (!arrayType.minLength) return []
      return Array.from(Array(arrayType.minLength))
        .map(() => gen(arrayType.$array, true)).filter(x => typeof x !== 'undefined')
    }
    const min = typeof arrayType.minLength === 'number' ? arrayType.minLength : options.arrayMin
    const max = Math.min(
      typeof arrayType.maxLength === 'number' ? arrayType.maxLength : options.arrayMax,
      saneMaximumSize)
    // TODO filtering out undefined, may violate minLength, write test to prove
    return Array.from(Array(randomNumber(true, Math.min(min, max), max)))
      .map(() => gen(arrayType.$array, true)).filter(x => typeof x !== 'undefined')
  }

  if (isEnum(type)) { return type.$enum[randomNumber(true, 0, type.$enum.length - 1)] }

  if (isKeyOf(type)) {
    const current = type.$keyOf.reduce((p: any, c) => p?.[c], rootType)
    if (!current) return ''
    const keys = Object.keys(current)
    // This does not work correctly, because the available keys depend on the input (and they might be optional)
    // It is overriden in the second pass done in the main generate method
    return keys[randomNumber(true, 0, keys.length - 1)]
  }

  if (isPropertyPath(type)) {
    return generatePropertyPath(rootType)
  }

  if (isObj(type)) {
    return Object.entries(type).reduce((prev: any, [key, value]) => {
      let val: any | Validation = value
      // This is strictly needed to generate a schema that makes sense
      const num = { $number: { min: 0, max: 16, integer: true } }
      if ((key === 'minLength' || key === 'maxLength') && (value === 'number')) {
        val = num
      }
      if ((key === 'minLength' || key === 'maxLength') && (value as any).$number) {
        val = { $number: { ...(value as any).$number, ...num.$number } }
      }
      if ((key === 'minLength' || key === 'maxLength') &&
        Array.isArray(value) && value.some((x: any) => x.$number)) {
        val = value.map((x: any) => x.$number ? { $number: { ...x.$number, ...num.$number } } : x)
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
    const count = depth >= options.maxDepthSoft ? min : randomNumber(true, min, max)
    if (min <= 0 || max > 64) {
      throw new Error(`Too big, too small, size does matter after all, ${count}, min: ${min}, max: ${max}`)
    }
    let specKey: any = mapType.keySpecificType
    while (typeof specKey === 'string') {
      if (!specKey.startsWith('$')) throw new Error('Invalid keySpecificType: ' + specKey)
      specKey = customTypes[specKey]
    }

    if (!specKey) specKey = {}

    return Array.from(Array(count))
      .reduce((prev: any) => {
        const specKeys = Object.keys(specKey)
        if (specKeys.length) {
          const key = specKeys[0].startsWith('\\$') ? specKeys[0].slice(1) : specKeys[0]
          prev[key] = gen(specKey[specKeys[0]], true)
        }
        const str = mapType.key ? gen(mapType.key) : simpleGeneration('string', options)
        prev[str] = gen(mapType.$map, true)
        return prev
      }, {})
  }

  if (isNumber(type)) {
    return randomNumber(
      type.$number.integer ?? false,
      type.$number.min == null ? options.minNumber : type.$number.min,
      type.$number.max == null ? options.maxNumber : type.$number.max)
  }

  if (isMeta(type)) { return gen(type.$type) }

  if (isString(type)) {
    if (type.$string.regex) {
      const types = Object.keys((rootType as any)?.$types || {})
      // This regex denotes generating a custom type name, Special case for generating own schema
      if (type.$string.regex === '^\\$([a-zA-Z0-9_]{1,128})$' && types.length) {
        const i = randomNumber(true, 0, types.length)
        return types[i]
      } else {
        const regexString = randexp.randexp(type.$string.regex)
        return regexString
      }
    }

    return randomString(options, type.$string.minLength === 0 || typeof type.$string.minLength === 'undefined' ? type.$string.maxLength : type.$string.minLength)
  }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, { root: {}, custom: customTypes }, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return gen(combined.pass)
  }

  if (isLiteral(type)) {
    return type.$literal
  }

  if (isTuple(type)) {
    return type.$tuple.map(x => gen(x))
  }

  throw new Error('Unknown type: ' + JSON.stringify(typeIn, null, 2))
}
