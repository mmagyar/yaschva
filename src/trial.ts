import { loadJson, validate } from './validate.js'
import fs from 'fs'
import { generate } from './generate/generate.js'
const file = fs.promises.readFile

const run = async (): Promise<any> => {
  const example = loadJson(await file('./testSchema5.json', 'utf8'))
  const sch = loadJson(await file('./selfSchema.json', 'utf8'))
  const result = validate(sch, example)
  if (result.result !== 'pass') {
    // UUU OOO Property path is not validated for type !!!???
    console.log(result, 'WARNING \n\n INPUT IS INVALID \n\n')
  }
  console.log(JSON.stringify(result,null, 2))
  let generated = null

  let validated = null

  for (let i = 0; i < 5000; i++) {
    console.log(i)
    generated = generate(example)
    validated = validate(example, generated)
    if (validated.result !== 'pass') {
      console.error('VALIDATION FAILED')
      fs.writeFileSync('./failValidateion.json', JSON.stringify(validated, null, 2))
      break
    }
  }
  return generated
}

run().then(x => {
  const result = JSON.stringify(x, null, 2)
  console.log('SUCCESS')
  fs.writeFileSync('./trial.json', result)
}).catch(x => {
  console.log('FAILLLEDDD___________')
  if (x instanceof Error) { console.log(x) } else { fs.writeFileSync('./failReport.json', JSON.stringify(x, null, 2)) }
})
