import { fork } from 'child_process'

const errorPattern = /Error in plugin .*:.*/g
const pluginNamePattern = /(?<=plugin ).*(?=:)/g
const infoPattern = /(?<=: ).*/g
const acceptedError = { plugin: '@nomiclabs/hardhat-etherscan', info: 'Contract source code already verified' }

const areErrorsAcceptable = (errors) => {
  return errors.map(error => {
    if (error === 'Debugger attached.') {
      return true
    }
    if (error === 'Waiting for the debugger to disconnect...') {
      return true
    }
    if (error === 'For more info run Hardhat with --show-stack-traces') {
      return true
    }
    if (errorPattern.test(error)) {
      const plugin = error.match(pluginNamePattern)
      const info = error.match(infoPattern)
      if (plugin[0] === acceptedError.plugin && info[0] === acceptedError.info) {
        return true
      }
    }
    return false
  })
}

const runScript = (scriptPath, args, options) => {
  return new Promise((resolve, reject) => {
    const process = fork(scriptPath, args, options)
    const errors = []

    process.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`.trim())
    })

    process.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`.trim())
      errors.push(data.toString().trim())
    })

    process.on('close', (code) => {
      // console.log(`child process exited with code ${code}`)
      const acceptableArray = areErrorsAcceptable(errors)
      const unnaceptableErrors = errors.filter((error, index) => error === acceptableArray[index])
      if (unnaceptableErrors.length > 0) { reject(new Error(unnaceptableErrors)) } else { resolve() }
    })
  })
}

const verify = (networkName, implementationAddress, constructorArgs) => {
  console.log('Verification has started.')
  return runScript(
    'node_modules/.bin/hardhat',
    ['verify', implementationAddress, '--network', networkName, ...constructorArgs],
    { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] })
}

export { verify }
