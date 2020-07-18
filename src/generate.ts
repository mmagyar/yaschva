import {
  Validation, isSimpleType, isArray, isEnum,
  isObj, isObjectMeta, isMap, isNumber, isMeta, isString, SimpleTypes
} from './validationTypes'
import { randexp } from 'randexp'
type Options = {
  arrayMin: number; arrayMax: number;
  mapMin: number; mapMax: number;
};
const minNumber = -Number.MAX_SAFE_INTEGER
const maxNumber = Number.MAX_SAFE_INTEGER
export const randomNumber = (
  isInteger = false, min: number = minNumber, max: number = maxNumber
): number => {
  const num = Math.random() * (max - min) + min
  if (isInteger) return Math.round(num)
  return num
}

const simpleTypes: SimpleTypes[] = ['number', 'integer', '?', 'string', 'boolean']
const randomString = (length = 6) => {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  for (let i = 0; i < length; i += 1) { result += characters.charAt(Math.floor(Math.random() * charactersLength)) }

  return result
}
const simpleGeneration = (type: SimpleTypes): any => {
  switch (type) {
    case 'any': return simpleGeneration(simpleTypes[randomNumber(true, 0, simpleTypes.length - 1)])
    case '?': return undefined
    case 'null': return null
    case 'number': return randomNumber()
    case 'integer': return randomNumber(true)
    case 'string': return randomString()
    case 'boolean': return Math.random() > 0.5
    default: throw new Error(`Unknown validator:${JSON.stringify(type)}`)
  }
}
export const generate = (type: Validation,
  options: Options = { arrayMin: 1, arrayMax: 90, mapMin: 1, mapMax: 33 }
): any => {
  if (isSimpleType(type)) { return simpleGeneration(type) }

  if (Array.isArray(type)) { return generate(type[randomNumber(true, 0, type.length - 1)]) }

  if (isArray(type)) {
    return Array.from(Array(randomNumber(true, options.arrayMin, options.arrayMax)))
      .map(() => generate(type.$array))
  }

  if (isEnum(type)) { return type.$enum[randomNumber(true, 0, type.$enum.length - 1)] }

  if (isObj(type)) {
    return Object.entries(type).reduce((prev: any, [key, value]) => {
      const generated = generate(value)
      if (typeof generated !== 'undefined') prev[key] = generated
      return prev
    }, {})
  }

  if (isObjectMeta(type)) { return generate(type.$object) }

  if (isMap(type)) {
    return Array.from(Array(randomNumber(true, options.mapMin, options.mapMax)))
      .reduce((prev: any) => {
        prev[randomString(8)] = generate(type.$map)
        return prev
      }, {})
  }

  if (isNumber(type)) { return randomNumber(false, type.$number.min, type.$number.max) }

  if (isMeta(type)) { return simpleGeneration(type.$type) }

  if (isString(type)) {
    if (type.$string.regex) { return randexp(type.$string.regex) }

    return randomString(type.$string.minLength || type.$string.maxLength || 6)
  }

  throw new Error('Unknown type')
}
