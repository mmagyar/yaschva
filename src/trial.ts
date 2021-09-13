import { loadJson, validate } from './validate.js'
import fs from 'fs'
import { generate } from './generate/generate.js'
const file = fs.promises.readFile

const run = async (): Promise<any> => {
  const example = loadJson(await file('./selfSchema.json', 'utf8'))
  const selfSchema = loadJson(await file('./selfSchema.json', 'utf8'))
  const result = validate(selfSchema, example)
  if (result.result !== 'pass') {
    console.log(result, 'WARNING \n\n INPUT IS INVALID \n\n')
    fs.writeFileSync('./testdata/failSchemaValidation.json', JSON.stringify(result.output, null, 2))
  }

  let generated = null

  let validated = null

  const count = 200
  for (let i = 0; i < count; i++) {
    console.log(i)
    const randomSeed = i
    generated = generate(example, { maxDepthSoft: 2, arrayMax: 3, randomSeed })
    fs.writeFileSync(`./testdata/generated-schema-${i}.json`, JSON.stringify(generated, null, 2))

    validated = validate(example, generated)
    const generatedData = generate(generated, { randomSeed })
    fs.writeFileSync(`./testdata/generated-${i}.json`, JSON.stringify(generatedData, null, 2))
    if (validated.result !== 'pass') {
      console.error('VALIDATION FAILED')
      fs.writeFileSync(`./testdata/failed_validation-${i}.json`, JSON.stringify(validated, null, 2))
      break
    }
  }
  return generated
}

run().then(x => {
  const result = JSON.stringify(x, null, 2)
  console.log('END')
  fs.writeFileSync('./trial.json', result)
}).catch(x => {
  console.log('FAILLLEDDD___________')
  if (x instanceof Error) { console.log(x) } else { fs.writeFileSync('./failReport.json', JSON.stringify(x, null, 2)) }
})
