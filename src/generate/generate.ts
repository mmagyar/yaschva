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

  const generated1stPass = generateInternal(type, { ...defaultOptions, ...options }, {}, 0, type)
  fs.writeFileSync('./faultRawGen.json', JSON.stringify(generated1stPass || {}, null, 2))
  const propertyPath = (data: any, path: string[] = []): any => {
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data?.symbol === 'symbol') return path
    const entries = Object.entries(data)
    const randomIndex = randomNumber(true, 0, entries.length)
    if (randomIndex === entries.length) {
      return path
    }

    return propertyPath(entries[randomIndex][1], path.concat([entries[randomIndex][0]]))
  }

  const replaceKeyOfAndPropertyPath = (data: any, rootData?: any): any => {
    const rootDataCurrent = rootData || data
    if (!data || typeof data !== 'object') return data
    const result: any = Array.isArray(data) ? [] : {}
    for (const [key, value] of Object.entries(data)) {
      if ((value as any)?.symbol === keyOfSymbol) {
        const current = (value as any).type.$keyOf.reduce((p: any, c: any) => p?.[c], rootDataCurrent)
        if (!current) {
          // fs.writeFileSync('./faultRoot.json', JSON.stringify(rootData, null, 2))
          // fs.writeFileSync('./faultCurrent.json', JSON.stringify(value, null, 2))
          console.error('CURRENT NOT FOUND', JSON.stringify(rootData, null, 2), 'CURRENT', JSON.stringify(value, null, 2))
        }
        const possibleKeys = Object.keys(current)

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

  return replaceKeyOfAndPropertyPath(generated1stPass)
}
