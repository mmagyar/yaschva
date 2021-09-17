import { Validation } from '../validationTypes.js'
import { randomNumber, seededRandom, setSeed } from './random.js'
import { generateInternal } from './internal.js'
import { keyOfSymbol, Options, propertyPathSymbol } from './config.js'
import fs from 'fs'

import { inspect } from 'util'

inspect.defaultOptions.depth = null

function shuffleArray<T> (arrayIn: T[]): T[] {
  const array = arrayIn.concat([])
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
  return array
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
        return { pathOg: path, path: obj[key], type: obj?.valueType }
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
    Object.keys(o).forEach(function (k) {
      if (k === '$___symbol') {
        parent[parentKey] = o.content
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

  // TODO Schema generation is failing because we are generating propertyPaths as keyof to non objects
  // TODO Also there are keyOf being generated for toplevel type (such as $map)

  // TODO Another slightly unrelated error: when base type is array, there cannot be $type keyOf property
  // TODO before starting to generate, check the schema if keyofs make any sense. But that may not be possible, so it may need to be on the fly. This is actually just a problem when the base type is not an object. Does it make any sense to do keyOf if the base type is not an object / map (or meta of those)? i don't think so. Need to check if i can disable this on schame level, but i think that would be too complicated, and not worth it (since such nonsense schema will fail on validation) so it's probably a problem with the generator, and i need to solve it there.

  const propertyPath = (data: any, onlyObjects: boolean, path: string[] = [], fallbackPath: string[] = []): any => {
    // console.log('DAAAA', JSON.stringify(path))
    // Maybe there should be no path generated to properties starting with a $? nah, thats not the solution / problem
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data?.symbol === 'symbol') {
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

  const symbolFinder = (data: any, rootData?: any): any => {
    const rootDataCurrent = rootData || data
    if (!data || typeof data !== 'object') return false

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, value] of Object.entries(data)) {
      if ((value as any)?.symbol === keyOfSymbol) {
        return true
      } else if ((value as any)?.symbol === propertyPathSymbol) {
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
      if ((value as any)?.symbol === keyOfSymbol) {
        const current = (value as any).type.$keyOf.reduce((p: any, c: any) => p?.[c], rootDataCurrent)

        if (!current) {
          result[key] = value
          // console.error('CURRENT NOT FOUND', JSON.stringify(rootData, null, 2), 'CURRENT', JSON.stringify(value, null, 2))
          continue
          // fs.writeFileSync('./faultRoot.json', JSON.stringify(rootData, null, 2))
          // fs.writeFileSync('./faultCurrent.json', JSON.stringify(value, null, 2))
        }

        // Skip generation when referencing an unresovled key
        if (current?.symbol === keyOfSymbol) {
          result[key] = value
          continue
        }

        let possibleKeys = []

        possibleKeys = Object.keys(current)

        if ((value as any).valueType) {
          result[key] = {}
          for (let i = 0; i < (value as any)?.size; i++) {
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
            result[key][randomKey] = generate((value as any).valueType)
          }
        } else if ((value as any).type.valueType) {
          const target = possibleKeys.find(x => current[x].$___symbol)
          console.log('TTT', target, key, value)
          // Forking infinite look
          if (!target) {
            throw new Error('What the fork')
          }
          result[key] = target // [target] = generate((value as any).valueType)

          // const randomKey = possibleKeys[randomNumber(true, 0, possibleKeys.length - 1)]

          //   console.log('KYOF', (value as any))
          //   // Randomize order
          //   const randPossibleKeys = shuffleArray(possibleKeys)
          //   // Check every if there are any that fit
          //   const customT = processCustomTypes(schema)
          //   randPossibleKeys.find(x => {
          //     // This may not be needed, since with the help of neededKeys i can resolve this
          //     const a = current[x]
          //     const b = validateRecursive((value as any).type.valueType, a, 0, { root: a, custom: customT.customTypes })
          //     console.log('AAAAA', a, b.result)
          //     return false
          //   })

          // TODO search for one that fits
        } else {
          result[key] = possibleKeys[randomNumber(true, 0, possibleKeys.length - 1)]
        }
      } else if ((value as any)?.symbol === propertyPathSymbol) {
        result[key] = propertyPath(rootDataCurrent, (value as any).type?.$propertyPath?.onlyObjects)
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

  removeMarkerSymbol(replaced)
  fs.writeFileSync('./faultRawGen3.json', JSON.stringify(replaced || {}, null, 2))

  return replaced
}
