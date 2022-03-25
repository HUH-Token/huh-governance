import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from '../src/signers'
import { gnosisSafe, multisig } from '../src/multisig'
import { getContract } from '../src/getContract'

const func = async (hre) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()
  const timestamp = await getContract('Timestamp')
  const safeERC20 = await getContract('ERC20Mock')

  await deploy('HUHGovernance',
    {
      contract: 'HUHGovernance',
      from: deployer.address,
      args: [
        safeERC20.address,
        timestamp.address,
        50 // Maximum lock time in years
      ],
      proxy: {
        proxyContract: 'ERC1967Proxy',
        proxyArgs: ['{implementation}', '{data}'],
        execute: {
          init: {
            methodName: 'init',
            args: [
              (multisig)? gnosisSafe : proxy01Owner.address,
              safeERC20.address,
              timestamp.address,
              50 // Maximum lock time in years
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
