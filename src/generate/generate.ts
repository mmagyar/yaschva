import { Validation } from '../validationTypes.js'
import { randomNumber, setSeed } from './random.js'
import { generateInternal } from './internal.js'
import { keyOfSymbol, Options, propertyPathSymbol } from './config.js'
import fs from 'fs'

import { inspect } from 'util'

inspect.defaultOptions.depth = null

// function shuffleArray<T> (arrayIn: T[]): T[] {
//   const array = arrayIn.concat([])
//   for (let i = array.length - 1; i > 0; i--) {
//     const j = Math.floor(seededRandom() * (i + 1));
//     [array[i], array[j]] = [array[j], array[i]]
//   }
//   return array
// }

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
    absoluteMaxStringSize: 8192,
    randomSeed: Math.random()
  }

  // Walk every proeprty on the type, AS IS, withouth resolving anything
  // While resolving may give more accurate results, it is not required here
  // Because we just need to get the keyOf parameters, and resolving everything,
  // May result in an infine loop, because schemas can be recursive

  interface FoundKeys {path: string[], type?: string[]}
  const iterate = (obj: {[key: string]: any}, path: Array<string|number> = []): FoundKeys[] => {
    const itrFunction = (key: string|number): any => {
      if (key === '$keyOf') {
        let valType: any = obj?.valueType

        // TODO temporary fix for requring keyof that is undefined (which is impossilbe in json)
        if (valType?.$type === '?') {
          valType = undefined
        }

        return { pathOg: path, path: obj[key], type: !valType || Array.isArray(valType) ? valType : [valType] }
      }

      if (typeof obj[key] === 'object') {
        const result = iterate(obj[key], path.concat([key]))
        if (!result || result?.length === 0) {
          return undefined
        }
        return result
      }
      return undefined
    }

    if (Array.isArray(obj)) {
      return obj.flatMap((val, i) => itrFunction(i)).filter(x => x)
    }

    return Object.keys(obj || {}).flatMap(itrFunction).filter(x => x)
  }

  function removeMarkerSymbol (o: any, parent?: any, parentKey?: any): void {
    Object.keys(o || {}).forEach(function (k) {
      if (k === '$___symbol') {
        parent[parentKey] = o.$___content
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete o[k]
      } else {
        if (o[k] !== null && typeof o[k] === 'object') {
          removeMarkerSymbol(o[k], o, k)
        }
      }
    })
  }

  // This reduce remove all but one for the same keyOf, but that is not valid, since we may require multiple different types to be in a keyof
  const neededKeysFor = iterate(type as any)
    .reduce((p: FoundKeys[], c: FoundKeys) => {
      if (!p.some(x => x.path.length === c.path.length && x.path.every((y, i) => y === c.path[i]) && x?.type?.length === c?.type?.length && x?.type?.every((y: string) => c?.type?.includes(y)))) {
        p.push({ path: c.path, type: c.type })
      }

      return p
    }, [])

  const usedOptions = { ...defaultOptions, ...options }
  setSeed(usedOptions.randomSeed)
  // console.log('PASSED DOWN', neededKeysFor)
  // TODO so the lacking generated type, duh i solved it, i just need to pass the typeinfo as well
  const generated1stPass = generateInternal(type, usedOptions, {}, 0, type, neededKeysFor)
  fs.writeFileSync('./faultRawGen.json', JSON.stringify(generated1stPass || {}, null, 2))

  /**
   *  TODO this is a crude, and not entierly correct way to handle the problem with generating a schema from self.
   * The correct solution will be to rewrite generate to use speical nodes for all values,
   * that can be analysed after generation.
   *
   * This could lead to real problems with generating data for real schemas, if they use $ sign in the output data
   */
  const isUsableObject = <T extends object>(input: T): boolean => {
    return !Object.entries(input || {}).find(([key, value]) => {
      if (key === '$type') {
        return isUsableObject(value)
      }
      return key.startsWith('$')
    })
  }

  const propertyPath = (data: any, onlyObjects: boolean, path: string[] = [], fallbackPath: string[] = []): any => {
    // console.log('DAAAA', JSON.stringify(path), data)
    // Maybe there should be no path generated to properties starting with a $? nah, thats not the solution / problem
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data?.symbol === 'symbol' || !isUsableObject(data)) {
      // console.log('EARLY PATH', onlyObjects ? fallbackPath : path, onlyObjects)
      return onlyObjects ? fallbackPath : path
    }
    const entries = Object.entries(data).filter(([key, value]) => !key.startsWith('$'))

    if (entries.length === 0) {
      return fallbackPath
    }
    const randomIndex = randomNumber(true, 0, entries.length - 1)
    if (randomNumber(true, 0, 1) === 1) { // Roll the dice, if we are deep enought
      return path
    }

    return propertyPath(entries[randomIndex][1], onlyObjects, path.concat([entries[randomIndex][0]]), path)
  }

  interface KeyOfMarker {
    $___symbol: typeof keyOfSymbol
    $___type: any
    $___keyof: boolean
    $___valueType?: Validation
    $___size?: number
  }

  interface PropertyPathMarker {
    $___symbol: typeof propertyPathSymbol
    $___type: any

  }

  const isKeyOfMarker = (tbd: any): tbd is KeyOfMarker => tbd?.$___symbol === keyOfSymbol
  const isPropertyPathOfMarker = (tbd: any): tbd is PropertyPathMarker => tbd?.$___symbol === propertyPathSymbol

  const symbolFinder = (data: any, rootData?: any): any => {
    const rootDataCurrent = rootData || data
    if (!data || typeof data !== 'object') return false

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, value] of Object.entries(data)) {
      if (isKeyOfMarker(value)) {
        return true
      } else if (isPropertyPathOfMarker(value)) {
        return true
      } else {
        if (symbolFinder(value, rootDataCurrent)) return true
      }
    }
    return false
  }

  const replaceKeyOfAndPropertyPath = (data: any, schema: Validation, rootData?: any): any => {
    const rootDataCurrent = rootData || data
    if (!data || typeof data !== 'object') return data
    const result: any = Array.isArray(data) ? [] : {}
    for (const [key, value] of Object.entries(data)) {
      if (isKeyOfMarker(value)) {
        const current = value.$___type.$keyOf.reduce((p: any, c: any) => p?.[c], rootDataCurrent)

        if (!current) {
          result[key] = value
          continue
        }

        // Skip generation when referencing an unresovled key
        if (current?.$___symbol === keyOfSymbol) {
          result[key] = value
          continue
        }

        let possibleKeys = []

        possibleKeys = Object.keys(current)

        /**
         * Again, an ugly hack, to make sure we are not generating direct infinte recursion
         * A more sophisticated solution should be implemented, either here or in the schema
         */
        possibleKeys = possibleKeys.filter(x => x !== key)

        if (value.$___valueType) {
          result[key] = {}
          for (let i = 0; i < (value.$___size ?? 0); i++) {
            let randomKey = possibleKeys[randomNumber(true, 0, possibleKeys.length - 1)]
            let safeWord = 0
            // Try getting a random prop, if we don't find any new in 10 tries, get the next unused,
            // with fallback to the first element if all are generated already.
            while (result[key][randomKey] && Object.keys(result[key]).length < possibleKeys.length) {
              randomKey = possibleKeys[randomNumber(true, 0, possibleKeys.length - 1)]
              safeWord++
              if (safeWord > 10) {
                randomKey = possibleKeys.find(x => typeof result[key][x] === 'undefined') ?? possibleKeys[0]
              }
            }
            // Just using generate does not work
            // result[key][randomKey] = generate(value.$___valueType)
            result[key][randomKey] = generateInternal(value.$___valueType, usedOptions, (type as any)?.$types ?? {}, 0, type, [])
          }
        } else if (value.$___type.valueType) {
          let parentRealKey: string | undefined
          if (key === '$___content') {
            parentRealKey = data.$___key
          }

          const target = parentRealKey ? possibleKeys.find(x => current[x].$___symbol && current[x].$___key !== parentRealKey) : possibleKeys.find(x => current[x]?.$___symbol)

          if (!target) {
            throw new Error(`What the fork: ${key} / ${parentRealKey ?? ''} target: ${target}`)
          }
          result[key] = target
        } else {
          result[key] = possibleKeys[randomNumber(true, 0, possibleKeys.length - 1)]
        }
      } else if (isPropertyPathOfMarker(value)) {
        result[key] = propertyPath(rootDataCurrent, value.$___type?.$propertyPath?.onlyObjects)
      } else {
        result[key] = replaceKeyOfAndPropertyPath(value, schema, rootDataCurrent)
      }
    }
    return result
  }

  let replaced = replaceKeyOfAndPropertyPath(generated1stPass, type)
  let safeWord = 0

  while (symbolFinder(replaced)) {
    replaced = replaceKeyOfAndPropertyPath(replaced, type)
    safeWord++
    if (safeWord > 10000) {
      // Failure to resolve, it adds property to keyOf that does not even exits on the final data (value was optional)
      fs.writeFileSync('./faultRawGen2.json', JSON.stringify(replaced || {}, null, 2))
      throw new Error('could not resolve all symbols in 10000 passes')
    }
  }

  if (!replaced?.$___symbol) {
    /**
     * This ugly if is needed because we are using recursion to generate parts, and sometimes it cannot be fully resolved before returning
     * Having a symbol at the root, means that it's impossible to remove
     */
    removeMarkerSymbol(replaced)
  }
  fs.writeFileSync('./faultRawGen3.json', JSON.stringify(replaced || {}, null, 2))

  return replaced
}
