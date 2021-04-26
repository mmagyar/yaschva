import {
  Validation, isSimpleType, isArray, isEnum,
  isObj, isMap, isNumber, isMeta, isAnd,
  isString, isTypeDefValidation, ValueTypes, isLiteral, isTuple, isKeyOf, KeyOfType, isPropertyPath
} from '../validationTypes.js'
import { combineValidationObjects } from '../validate.js'
import { randomNumber } from './random.js'
import { generateInternal } from './internal.js'
import { Options } from './config.js'

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
