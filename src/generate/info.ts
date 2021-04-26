import { combineValidationObjects } from '../validate.js'
import { isArray, isSimpleType, isEnum, isKeyOf, Validation, ValueTypes, isPropertyPath, isObj, isNumber, isString, isMap, isMeta, isAnd, isLiteral, isTuple } from '../validationTypes.js'
export const findEarliestTermination =
 <T extends {[key: string]: Validation}>(input: T): Array<{key: keyof T, depth: number}> => {
   return []
 }

const maxDepth = 99

export const getMinimumDepth = (type: ValueTypes, customTypes: { [key: string]: Validation },
  depth: number = 0): number => {
  if (depth > maxDepth) return depth

  const gen = (type: Validation, increaseDepth: boolean): number =>
    getMinimumDepth(type, customTypes, increaseDepth ? depth + 1 : depth)

  if (isSimpleType(type)) {
    if (customTypes[type]) {
      return gen(customTypes[type], false)
    }

    // Depth does not increase anymore with simple types
    return depth
  }

  if (isEnum(type) ||
  isKeyOf(type) ||
  isPropertyPath(type) ||
  isNumber(type) ||
  isString(type) ||
  isLiteral(type)) { return depth }

  if (Array.isArray(type)) {
    const allDepths = []
    for (const element of type) {
      const result = gen(element, true)
      if (result === depth + 1) return result
      allDepths.push(result)
    }
    return Math.min(depth, ...allDepths)
  }

  if (isArray(type)) {
    if (!type.minLength) return depth

    return gen(type.$array, true)
  }

  if (isObj(type)) {
    const results = []
    for (const value of Object.values(type)) {
      const result = gen(value, true)
      if (result === depth + 1) return result
      results.push(result)
    }
    return Math.min(depth, ...results)
  }

  if (isMap(type)) {
    if (!type.minLength) return depth
    // This needs some work, since it may or may not terminate if key specific types are given
    // const keySizes = Object.values(type.keySpecificType ?? {}).map(x => gen(x, true))
    // If key specificity is needed, we need to get the largest
    // Keys may be restricted to separately specified keys, and working with minLength to enforce
    // This may need a new test case as well
    // This is a TODO, not needed for mvp of data generation
    return gen(type.$map, true)
  }

  if (isMeta(type)) { return gen(type.$type, false) }

  if (isAnd(type)) {
    const combined = combineValidationObjects(type, { root: {}, custom: customTypes }, (x) => x)
    if (combined.result === 'error') {
      throw new Error('Schema error, $and types must be objects: ' + JSON.stringify(combined.error, null, 2))
    }

    return gen(combined.pass, false)
  }

  if (isTuple(type)) {
    return Math.min(...(type.$tuple.map((x: ValueTypes) => gen(x, false))))
  }

  throw new Error('Unknown type: ' + JSON.stringify(type, null, 2))
}
