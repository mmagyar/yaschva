/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable no-var */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
import { seededRandom } from '../generate/random.js'
import DRange from 'drange'
import ret from 'ret'
const types = (ret as any).types

export default class RandExp {
  ignoreCase: boolean
  multiline: boolean
  tokens: any
  max: any
  _range: any
  /**
   * @constructor
   * @param {RegExp|String} regexp
   * @param {String} m
   */
  constructor (regexp: RegExp | string, m?: string) {
    this._setDefaults(regexp)
    if (regexp instanceof RegExp) {
      this.ignoreCase = regexp.ignoreCase
      this.multiline = regexp.multiline
      regexp = regexp.source
    } else if (typeof regexp === 'string') {
      this.ignoreCase = !!(m?.includes('i'))
      this.multiline = !!(m?.includes('m'))
    } else {
      throw new Error('Expected a regexp or string')
    }

    this.tokens = ret(regexp)
  }

  /**
   * Checks if some custom properties have been set for this regexp.
   *
   * @param {RandExp} randexp
   * @param {RegExp} regexp
   */
  _setDefaults (regexp: RegExp | any): void {
    // When a repetitional token has its max set to Infinite,
    // randexp won't actually generate a random amount between min and Infinite
    // instead it will see Infinite as min + 100.
    this.max = regexp.max != null
      ? regexp.max
      : RandExp.prototype.max != null ? RandExp.prototype.max : 100

    // This allows expanding to include additional characters
    // for instance: RandExp.defaultRange.add(0, 65535);
    this.defaultRange = regexp.defaultRange
      ? regexp.defaultRange
      : (this.defaultRange as any).clone()

    if (regexp.randInt) {
      this.randInt = regexp.randInt
    }
  }

  /**
   * Generates the random string.
   *
   * @return {String}
   */
  gen (): any {
    return this._gen(this.tokens, [])
  }

  /**
   * Generate random string modeled after given tokens.
   *
   * @param {Object} token
   * @param {Array.<String>} groups
   * @return {String}
   */
  _gen (token: any, groups: Array<string|null>): undefined | string {
    let stack, str, n, i, l

    switch (token.type) {
      case types.ROOT:
      case types.GROUP:
        // Ignore lookaheads for now.
        if (token.followedBy || token.notFollowedBy) { return '' }

        // Insert placeholder until group string is generated.
        if (token.remember && token.groupNumber === undefined) {
          token.groupNumber = groups.push(null) - 1
        }

        stack = token.options
          ? this._randSelect(token.options)
          : token.stack

        str = ''
        for (i = 0, l = stack.length; i < l; i++) {
          str += this._gen(stack[i], groups)
        }

        if (token.remember) {
          groups[token.groupNumber] = str
        }
        return str

      case types.POSITION:
        // Do nothing for now.
        return ''

      case types.SET:
        var expandedSet = this._expand(token)
        if (!expandedSet.length) { return '' }
        return String.fromCharCode(this._randSelect(expandedSet))

      case types.REPETITION:
        // Randomly generate number between min and max.
        n = this.randInt(token.min,
          token.max === Infinity ? token.min + this.max : token.max)

        str = ''
        for (i = 0; i < n; i++) {
          str += this._gen(token.value, groups)
        }

        return str

      case types.REFERENCE:
        return groups[token.value - 1] || ''

      case types.CHAR:
        var code = this.ignoreCase && this._randBool()
          ? this._toOtherCase(token.value)
          : token.value
        return String.fromCharCode(code)
    }
    return undefined
  }

  /**
   * If code is alphabetic, converts to other case.
   * If not alphabetic, returns back code.
   *
   * @param {Number} code
   * @return {Number}
   */
  _toOtherCase (code: number): number {
    return code + (code >= 97 && code <= 122
      ? -32
      : code >= 65 && code <= 90 ? 32 : 0)
  }

  /**
   * Randomly returns a true or false value.
   *
   * @return {Boolean}
   */
  _randBool (): boolean {
    return !this.randInt(0, 1)
  }

  /**
   * Randomly selects and returns a value from the array.
   *
   * @param {Array.<Object>} arr
   * @return {Object}
   */
  _randSelect (arr: object[]): any {
    if (arr instanceof DRange) {
      return arr.index(this.randInt(0, arr.length - 1))
    }
    return arr[this.randInt(0, arr.length - 1)]
  }

  /**
   * expands a token to a DiscontinuousRange of characters which has a
   * length and an index function (for random selecting)
   *
   * @param {Object} token
   * @return {DiscontinuousRange}
   */
  _expand (token: any): any {
    if (token.type === (ret as any).types.CHAR) {
      return new DRange(token.value)
    } else if (token.type === (ret as any).types.RANGE) {
      return new DRange(token.from, token.to)
    } else {
      const drange = new DRange()
      for (let i = 0; i < token.set.length; i++) {
        const subrange = this._expand(token.set[i])
        drange.add(subrange)
        if (this.ignoreCase) {
          for (let j = 0; j < subrange.length; j++) {
            const code = subrange.index(j)
            const otherCaseCode = this._toOtherCase(code)
            if (code !== otherCaseCode) {
              drange.add(otherCaseCode)
            }
          }
        }
      }
      if (token.not) {
        return (this.defaultRange as any).clone().subtract(drange)
      } else {
        return (this.defaultRange as any).clone().intersect(drange)
      }
    }
  }

  /**
   * Randomly generates and returns a number between a and b (inclusive).
   *
   * @param {Number} a
   * @param {Number} b
   * @return {Number}
   */
  randInt (a: number, b: number): number {
    return a + Math.floor(seededRandom() * (1 + b - a))
  }

  /**
   * Default range of characters to generate from.
   */
  get defaultRange (): void {
    // eslint-disable-next-line no-return-assign
    return this._range = this._range || new DRange(32, 126)
  }

  set defaultRange (range) {
    this._range = range
  }

  /**
   *
   * Enables use of randexp with a shorter call.
   *
   * @param {RegExp|String| regexp}
   * @param {String} m
   * @return {String}
   */
  static randexp (regexp: any, m?: string): string {
    let randexp
    if (typeof regexp === 'string') {
      regexp = new RegExp(regexp, m)
    }

    if (regexp._randexp === undefined) {
      randexp = new RandExp(regexp, m)
      regexp._randexp = randexp
    } else {
      randexp = regexp._randexp
      randexp._setDefaults(regexp)
    }
    return randexp.gen()
  }

  /**
   * Enables sugary /regexp/.gen syntax.
   */
  static sugar (): void {
    /* eshint freeze:false */
    // eslint-disable-next-line no-extend-native
    (RegExp.prototype as any).gen = function () {
      return (RandExp as any).randexp(this)
    }
  }
}
