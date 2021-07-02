
export interface Options {
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

export const keyOfSymbol = Symbol('KeyOf')
export const propertyPathSymbol = Symbol('PropertyPath')
