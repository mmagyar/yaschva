import {
  Validation, isSimpleType, isArray, isEnum,
  isObj, isMap, isNumber, isMeta, isAnd,
  isString, SimpleTypes, isTypeDefValidation, ValueTypes, isLiteral, isTuple, isKeyOf, KeyOfType, isPropertyPath
} from './validationTypes.js'
import { combineValidationObjects } from './validate.js'
import randexp from 'randexp'
interface Options {
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
export const randomNumber = (isInteger: boolean, c1: number, c2: number): number => {
  const min = Math.min(c1, c2)
  const max = Math.max(c1, c2)
  const num = Math.random() * (max - min) + min
  if (isInteger) return Math.round(num)
  return num
}

const simpleTypes: SimpleTypes[] = ['number', 'integer', '?', 'string', 'boolean']
const randomString = (options: Options, lengthIn?: number): string => {
  const length = lengthIn ??
    randomNumber(true, options.minStringLength, options.maxStringLength)

  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  const max = Math.min(length, options.absoluteMaxStringSize)
  for (let i = 0; i < max; i += 1) { result += characters.charAt(Math.floor(Math.random() * charactersLength)) }

  return result
}
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

export const generate = (type: Validation, options: Partial<Options> = {}): any => {
  const defaultOptions: Options = {
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

  const generated1stPass = generateInternal(type, { ...defaultOptions, ...options }, {}, 0, type)
  const keyOf = keyOfPaths(type, {}, type)

  /**
   * Makes sure that the generated property path is valid to not only
   * the property path, but the actual data as well.
   * This is needed, because generating the property path from the schema
   * may include optional values, that are not in the final generated data.
   *
   **/
  const res = keyOf?.filter(x => x.isPropertyPath && x.path.length).map(x => x.path)
  if (res?.length) {
    res?.forEach(x => {
      const propertyPath = x.reduce((p, c) => {
        return p[c]
      }, generated1stPass)
      console.log(x, propertyPath)

      let previous = generated1stPass
      const newPath = []
      for (const el of propertyPath) {
        let current
        if (previous && typeof previous === 'object') {
          current = previous[el]
        }

        if (current) {
          newPath.push(el)
          previous = current
        } else {
          break
        }
      }
      while (propertyPath.length > 0) {
        propertyPath.pop()
      }
      newPath.forEach(x => propertyPath.push(x))
    })
  }

  /**
   * Makes sure that keyOf property only allows values that actually exist,
   * This is needed since the keyOf properties may be generated before
   * the whole data structure is done in the first pass.
   */
  keyOf?.forEach(x => {
    if (!x.keyOff || !x.path || x.isPropertyPath) return

    const options = Object.keys(x.keyOff.reduce((p, c) => {
      return p[c]
    }, generated1stPass))

    let previous = generated1stPass
    for (const el of x.path) {
      if (typeof previous[el] === 'string') {
        if (!options.find(x => x === previous[el])) {
          previous[el] = options[randomNumber(true, 0, options.length - 1)]
        }
      } else {
        previous = previous[el]
      }
    }
    // This is used for scenarios when the keys of a map depend on another object
    if (x.where === 'map') {
      for (const key of Object.keys(previous)) {
        if (!options.find(x => x === key)) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete previous[key]
        }
      }
    }
  })
  return generated1stPass
}

/**
 * Generate a random, but valid property path from schema
 */
export const generatePropertyPath = (
  typeIn: Validation,
  typesIn: { [key: string]: Validation } = {},
  depth: number = 0,
  path: string[] = []
): string[] => {
  if (depth >= 32) {
    return path
  }

  let customTypes = typesIn
  let type: ValueTypes = typeIn
  if (isTypeDefValidation(typeIn)) {
    customTypes = typeIn.$types
    type = { ...typeIn }
    delete type.$types
  }

  const gen = (type: Validation, pathAdd?: string): string[] =>
    generatePropertyPath(type, customTypes, depth + 1, pathAdd ? path.concat([pathAdd]) : path)

  if (isSimpleType(type)) {
    if (customTypes[type]) {
      return gen(customTypes[type])
    }

    return path
  }

  if (Array.isArray(type)) {
    const objectType = type.find(x => isObj(x))
    if (!objectType) return path
    return gen(objectType)
  }

  if (isObj(type)) {
    const keys = Object.keys(type)
    const randomIndex = randomNumber(true, 0, keys.length)
    if (randomIndex === keys.length) {
      return path
    }
    return gen(type[keys[randomIndex]], keys[randomIndex])
  }

  return path
}

interface KeyOffSearch {
  keyOff?: string[]
  path: string[]
  depth: number
  valueType: any
  where?: 'map'
  isPropertyPath?: boolean
}
/**
 * This method is used to generate a valid keyOf property in the second phase of the generation
 */
export const keyOfPaths = (
  typeIn: Validation,
  typesIn: { [key: string]: Validation },
  rootType: Validation,
  depth: number = 0,
  path: string[] = []
): KeyOffSearch[] | undefined => {
  if (depth >= 32) {
    return [{ keyOff: [], path: [], depth: 999999, valueType: undefined }]
  }

  let customTypes = typesIn
  let type: ValueTypes = typeIn
  if (isTypeDefValidation(typeIn)) {
    customTypes = typeIn.$types
    type = { ...typeIn }
    delete type.$types
  }

  const gen = (type: Validation, pathAdd?: string): any =>
    keyOfPaths(type, customTypes, rootType, depth + 1, pathAdd ? path.concat([pathAdd]) : path)

  if (isSimpleType(type)) {
    if (customTypes[type]) {
      return gen(customTypes[type])
    }

    return undefined
  }

  if (Array.isArray(type)) {
    const arrayResult = type.reduce((p, x) => {
      const el = gen(x)
      return el ? p.concat(el) : p
    }, [])
    if (arrayResult.length) return arrayResult
    return undefined
  }

  if (isArray(type)) {
    return gen(type.$array)
  }

  if (isEnum(type)) { return undefined }

  if (isKeyOf(type)) {
    const current = type.$keyOf.reduce((p: any, c) => p?.[c], rootType)
    if (!current) return undefined
    return [{ keyOff: type.$keyOf, path: path, depth, valueType: type.valueType }]
  }

  if (isPropertyPath(type)) {
    return [{ path: path, depth, valueType: 'any', isPropertyPath: true }]
  }

  if (isObj(type)) {
    const objectResult = Object.entries(type).reduce((prev: any, [key, value]) => {
      const keyC = key.startsWith('\\$') ? key.slice(1) : key
      const checked = gen(value, keyC)
      if (checked) {
        return prev.concat(checked)
      }
      return prev
    }, [])
    if (objectResult?.length) return objectResult
    else return undefined
  }

  if (isMap(type)) {
    const mapType = type

    const isKeyType = (input: any): input is KeyOfType => {
      return !!input?.$keyOf
    }

    const add = []
    const keyType = type.key
    if (isKeyType(keyType)) {
      add.push({ keyOff: keyType.$keyOf, path: path, depth, valueType: keyType.valueType, where: 'map' })
    }

    const specific = Object.entries(mapType.keySpecificType ?? {}).map(([key, value]) => gen(value, key))
    const other = gen(mapType.$map, '*')
    const mapResult = specific.concat(other).concat(add).filter(x => x !== undefined)
    if (mapResult.length) return mapResult
    return undefined
  }

  if (isNumber(type)) { return undefined }

  if (isMeta(type)) { return gen(type.$type) }

  if (isString(type)) { return undefined }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, { root: {}, custom: customTypes }, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return gen(combined.pass)
  }

  if (isLiteral(type)) { return undefined }

  if (isTuple(type)) {
    const tupleResult = type.$tuple.map(x => gen(x)).filter(x => x !== undefined)
    return tupleResult.length ? tupleResult : undefined
  }

  throw new Error('Unknown type: ' + JSON.stringify(typeIn, null, 2))
}

const generateInternal = (
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
    const count = randomNumber(true, min, max)
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
