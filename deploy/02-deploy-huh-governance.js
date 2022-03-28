import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from '../src/signers'
import { gnosisSafe, multisig } from '../src/multisig'
import { getContract } from '../src/getContract'
import { getContractArgs } from '../src/getContractArgs'

const func = async (hre) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()
  const timestamp = await getContract('Timestamp')
  const acceptedToken = await getContract('ERC20Mock')

  const deployArtifacts = { acceptedToken, timestamp }

  const args = getContractArgs(deployArtifacts)

  await deploy('HUHGovernance',
    {
      contract: 'HUHGovernance',
      from: deployer.address,
      args,
      proxy: {
        proxyContract: 'ERC1967Proxy',
        proxyArgs: ['{implementation}', '{data}'],
        execute: {
          init: {
            methodName: 'init',
            args: [
              (multisig) ? gnosisSafe : proxy01Owner.address,
              ...args
            ]
          }
        }
      },
      log: true
    })
  // if (multisig) {
  //   const hUHGovernance = await getContract('HUHGovernance')
  //   console.log('Transferring ownership of ProxyAdmin...')
  //   // The owner of the ProxyAdmin can upgrade our contracts
  //   await hUHGovernance.connect(proxy01Owner).transferProxyOwnership(gnosisSafe)
  //   console.log('Transferred ownership of ProxyAdmin to:', gnosisSafe)
  // }
}
export default func
func.tags = ['HUHGovernance']
module.exports.dependencies = ['Timestamp', 'ERC20Mock']
