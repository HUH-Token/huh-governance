import { spawn } from 'child_process'
import { onExit } from '@rauschma/stringio'

const verify = async (networkName, implementationAddress, constructorArgs) => {
  const childProcess = spawn('scripts/verify-address.sh',
    [networkName, implementationAddress, ...constructorArgs],
    { stdio: [process.stdin, process.stdout, process.stderr] })
  await onExit(childProcess)
}

export { verify }
