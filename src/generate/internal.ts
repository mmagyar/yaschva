
import randexp from '../randexp/index.js'
import { combineValidationObjects } from '../validate.js'
import { Validation, ValueTypes, isTypeDefValidation, isSimpleType, isEnum, isKeyOf, isPropertyPath, isObj, isMap, isMeta, isAnd, isLiteral, isTuple, SimpleTypes, isArray, isNumber, isString, ValueType } from '../validationTypes.js'
import { keyOfSymbol, mapSymbol, Options, propertyPathSymbol } from './config.js'
import { getMinimumDepth } from './info.js'
import { randomBoolean, randomNumber, randomString } from './random.js'

const saneMaximumSize = 12

const arrayEq = (x: string[], c: string[]): boolean => x.length === c.length && x.every((y, i) => y === c[i])
// const needed = (x: Array<{path: string[], type?: any}>, y: string[]): boolean => x.some(z => arrayEq(y, z.path))
const needed = (x: Array<{path: string[], type?: any}>, y: string[]): Array<{path: string[], type?: any}> =>
  x.filter(z => arrayEq(y, z.path))
const simpleTypes: SimpleTypes[] = ['number', 'integer', '?', 'string', 'boolean']
const simpleGeneration = (type: SimpleTypes, options: Options): any => {
  switch (type) {
    case 'any': return simpleGeneration(simpleTypes[randomNumber(true, 0, simpleTypes.length - 1)], options)
    case '?': return undefined
    case 'null': return null
    case 'number': return randomNumber(false, options.minNumber, options.maxNumber)
    case 'integer': return randomNumber(true, options.minNumber, options.maxNumber)
    case 'string': return randomString(options)
    case 'boolean': return randomBoolean()
    default: throw new Error(`Unknown validator:${JSON.stringify(type)}`)
  }
}

const applyPreference = (input: Validation[], options: Options): Validation[] => {
  let result: any|undefined
  if (options.prefer === 'defined') {
    result = input.length > 1 ? input.filter(x => x !== '?') : input
  }
  if (options.prefer === 'undefined') {
    result = input.find(x => x === '?') ? ['?'] : input
  }
  return result?.length ? result : input
}
// NOTE TODO may mark values generated because of a keyOf, so it's easier to associate
export const generateInternal = (
  typeIn: Validation,
  options: Options,
  typesIn: { [key: string]: Validation },
  depth: number,
  rootType: Validation,
  neededPaths: Array<{path: string[], type?: any}>,
  currentPath: string[] = []
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

  const gen = (type: Validation, increaseDepth: boolean = false, currentPathMod?: string[]): any => {
    const res = generateInternal(type, options, customTypes, increaseDepth ? depth + 1 : depth, rootType, neededPaths, currentPathMod ?? currentPath)
    if (res === '$literalType') {
      console.log('SAY WHAT')
    }
    return res
  }

  if (isSimpleType(type)) {
    if (customTypes[type]) {
      return gen(customTypes[type])
    }

    return simpleGeneration(type, options)
  }

  if (Array.isArray(type)) {
    const need = needed(neededPaths, currentPath)
    if (!need.length && depth > options.maxDepthSoft) {
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
      // Use a defined value if this path is referenced as keyOf
      const typeArray = applyPreference(type, need.length ? { ...options, prefer: 'defined' } : options)
      const randomIndex = randomNumber(true, 0, typeArray.length - 1)

      // DELETE THIS, IT"S JUST A TEST TO DEBUG
      // while (typeArray[randomIndex] === '$customType') {
      //   randomIndex = randomNumber(true, 0, typeArray.length - 1)
      // }

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
    // Just Return a symbol, will resolve it in the second pass
    return { $___symbol: keyOfSymbol, $___keyof: true, $___type: type }
  }

  if (isPropertyPath(type)) {
    // Just Return a symbol, will resolve it in the second pass
    return { $___symbol: propertyPathSymbol, $___propertyPath: true, $___type: type }
  }

  if (isObj(type)) {
    const need = needed(neededPaths, currentPath)
    return Object.entries(type).reduce((prev: any, [key, value]) => {
      let current
      if (need.length) {
        current = need.pop()
      }
      if (current?.type) {
        const keyC = key.startsWith('\\$') ? key.slice(1) : key

        const generated = gen(current.type, true, currentPath.concat([keyC]))
        if (typeof generated !== 'undefined') {
          prev[keyC] = {
            $___type: current.type,
            $___key: keyC,
            $___symbol: mapSymbol,
            $___content: generated
          }
        }
        return prev
      }

      let val: any | Validation = value
      // This is strictly needed to generate a schema that makes sense
      const num = { $number: { min: 0, max: 16, integer: true } }
      if ((key === 'minLength' || key === 'maxLength') && (value === '$optionalPositiveInteger')) {
        val = num
      }
      if ((key === 'minLength' || key === 'maxLength') && (value as any).$number) {
        console.log('NOW THIS')
        val = { $number: { ...(value as any).$number, ...num.$number } }
      }
      if ((key === 'minLength' || key === 'maxLength') &&
        Array.isArray(value) && value.some((x: any) => x.$number)) {
        console.log('NOW That')
        val = value.map((x: any) => x.$number ? { $number: { ...x.$number, ...num.$number } } : x)
      }

      const keyC = key.startsWith('\\$') ? key.slice(1) : key
      const generated = gen(val, true, currentPath.concat([keyC]))

      if (typeof generated !== 'undefined') prev[keyC] = generated
      return prev
    }, {})
  }

  if (isMap(type)) {
    const mapType = type
    let min = typeof mapType.minLength === 'number' ? mapType.minLength : options.mapMin
    // This map is referenced as keyOf, override minLength if it's less then one,
    // to make sure we have at least on element to refer
    const need = needed(neededPaths, currentPath)

    if (min < need.length) {
      min = need.length
    }

    const max = Math.min(
      typeof mapType.maxLength === 'number' ? mapType.maxLength : options.mapMax,
      saneMaximumSize)

    if (depth >= options.maxDepthSoft && !mapType.minLength && !need.length) return {}

    const count = depth >= options.maxDepthSoft ? min : randomNumber(true, min, max)
    if (min < 0 || max > 64) { // Why did i put this her??
      throw new Error(`Too big, too small, size does matter after all, ${count}, min: ${min}, max: ${max}`)
    }
    let specKey: any = mapType.keySpecificType
    while (typeof specKey === 'string') {
      if (!specKey.startsWith('$')) throw new Error('Invalid keySpecificType: ' + specKey)
      specKey = customTypes[specKey]
    }

    if (!specKey) specKey = {}
    if (isKeyOf(mapType.key ?? {})) {
      return { $___symbol: keyOfSymbol, $___type: mapType.key, $___valueType: mapType.$map, $___size: count }
    }

    const specKeys = Object.keys(specKey)

    const doneMap = Array.from(Array(count))
      .reduce((prev: any) => {
        if (specKeys.length) {
          const key = specKeys[0].startsWith('\\$') ? specKeys[0].slice(1) : specKeys[0]
          prev[key] = gen(specKey[specKeys[0]], true, currentPath.concat([key]))
        }
        // Okay, so if the key type contains keyOf, the map generation need to be deffered
        // It also needs to know it's own path, since it does not make sense to point to itself
        // This above might be out of date, key generation is not a problem actually in and of itself

        const str = mapType.key ? gen(mapType.key) : simpleGeneration('string', options)

        let current
        if (need.length) {
          current = need.pop()
        }
        if (current?.type) {
          prev[str] = gen(current.type, true, currentPath.concat([str]))
          prev[str] = {
            $___type: current.type,
            $___key: str,
            $___symbol: mapSymbol,
            $___content: prev[str]
          }
          need.pop()
        } else {
          prev[str] = gen(mapType.$map, true, currentPath.concat([str]))
        }
        return prev
      }, {})

    // console.log('DM', doneMap)
    return doneMap
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
      let regexString = ''
      let i = 0
      do {
        regexString = randexp.randexp(type.$string.regex)
        i++
        if (i > 128) {
          throw new Error('Generated string does not match regexp for 128 times')
        }
        if (i > 1) {
          // This should really never happen, need to reviese the generation lib
          console.log('Needed multiple retries to generate a string matching the regex', type.$string.regex, 'with', regexString)
        }
      } while (!(new RegExp(type.$string.regex)).test(regexString))
      return regexString
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
