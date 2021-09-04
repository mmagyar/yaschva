import { loadJson, validate } from './validate.js'
import fs from 'fs'
import { generate } from './generate/generate.js'
const file = fs.promises.readFile

const run = async (): Promise<any> => {
  const example = loadJson(await file('./testSchema3.json', 'utf8'))
  let generated = null

  let validated = null

  for (let i = 0; i < 5000; i++) {
    console.log(i)
    generated = generate(example)
    validated = validate(example, generated)
    if (validated.result !== 'pass') break
  }
  return { generated, validated }
}

run().then(x => {
  const result = JSON.stringify(x, null, 2)
  console.log('SUCCESS', result)
  fs.writeFileSync('./trial.json', result)
}).catch(x => console.log('FAILLLEDDD___________', x))
