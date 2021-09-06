import { Validation } from '../validationTypes.js'
import { randomNumber } from './random.js'
import { generateInternal } from './internal.js'
import { keyOfSymbol, Options, propertyPathSymbol } from './config.js'
import fs from 'fs'
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

  // Walk every proeprty on the type, AS IS, withouth resolving anything
  // While resolving may give more accurate results, it is not required here
  // Because we just need to get the keyOf parameters, and resolving everything,
  // May result in an infine loop, because schemas can be recursive

  const iterate = (obj: {[key: string]: any}, path: Array<string|number> = []): any => {
    const itrFunction = (key: string|number): any => {
      if (key === '$keyOf') {
        return { path: path, value: obj[key] }
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
    return Object.keys(obj).flatMap(itrFunction).filter(x => x)
  }

  const neededKeysFor = iterate(type as any)?.map((x: any) => x.value).reduce((p: string[][], c: string[]) => {
    if (!p.some(x => x.length === c.length && x.every((y, i) => y === c[i]))) {
      p.push(c)
    }

    return p
  }, [])

  const generated1stPass = generateInternal(type, { ...defaultOptions, ...options }, {}, 0, type, neededKeysFor)
  fs.writeFileSync('./faultRawGen.json', JSON.stringify(generated1stPass || {}, null, 2))

  const propertyPath = (data: any, path: string[] = []): any => {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data?.symbol === 'symbol') return path
    const entries = Object.entries(data)
    const randomIndex = randomNumber(true, 0, entries.length)
    if (randomIndex === entries.length) {
      return path
    }

    // TODO Schema generation is failing because we are generating propertyPaths as keyof to non objects
    // TODO Also there are keyOf being generated for toplevel type (such as $map)

    // TODO Another slightly unrelated error: when base type is array, there cannot be $type keyOf property

    return propertyPath(entries[randomIndex][1], path.concat([entries[randomIndex][0]]))
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

  const replaceKeyOfAndPropertyPath = (data: any, rootData?: any): any => {
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

        if (!(value as any).valueType) {
          result[key] = possibleKeys[randomNumber(true, 0, possibleKeys.length - 1)]
        } else {
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
        }
      } else if ((value as any)?.symbol === propertyPathSymbol) {
        result[key] = propertyPath(rootDataCurrent)
      } else {
        result[key] = replaceKeyOfAndPropertyPath(value, rootDataCurrent)
      }
    }
    return result
  }

  let replaced = replaceKeyOfAndPropertyPath(generated1stPass)
  let safeWord = 0

  while (symbolFinder(replaced)) {
    replaced = replaceKeyOfAndPropertyPath(replaced)
    safeWord++
    if (safeWord > 10000) {
      // Failure to resolve, it adds property to keyOf that does not even exits on the final data (value was optional)
      fs.writeFileSync('./faultRawGen2.json', JSON.stringify(replaced || {}, null, 2))
      throw new Error('could not resolve all symbols in 10000 passes')
    }
  }
  fs.writeFileSync('./faultRawGen3.json', JSON.stringify(replaced || {}, null, 2))

  return replaced
}
