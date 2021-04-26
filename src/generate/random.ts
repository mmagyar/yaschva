import { isObj, isSimpleType, isTypeDefValidation, Validation, ValueTypes } from '../validationTypes.js'
import { Options } from './config.js'

export const randomNumber = (isInteger: boolean, c1: number, c2: number): number => {
  const min = Math.min(c1, c2)
  const max = Math.max(c1, c2)
  const num = Math.random() * (max - min) + min
  if (isInteger) return Math.round(num)
  return num
}

export const randomString = (options: Options, lengthIn?: number): string => {
  const length = lengthIn ??
    randomNumber(true, options.minStringLength, options.maxStringLength)

  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  const max = Math.min(length, options.absoluteMaxStringSize)
  for (let i = 0; i < max; i += 1) { result += characters.charAt(Math.floor(Math.random() * charactersLength)) }

  return result
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
