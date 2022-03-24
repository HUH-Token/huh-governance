import { ethers } from 'hardhat'
import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from '../src/signers'
import { gnosisSafe, multisig } from '../src/multisig'

const func = async (hre) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()
  const timestampContract = await deployments.get('Timestamp')
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  const tokenContract = await deployments.get('ERC20Mock')
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach(tokenContract.address)

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
              proxy01Owner.address,
              safeERC20.address,
              timestamp.address,
              50 // Maximum lock time in years
            ]
          }
        }
      },
      log: true
    })
  const hUHGovernance = await ethers.getContractAt('HUHGovernance', (await deployments.get('HUHGovernance')).address)
  if (multisig) {
    console.log('Transferring ownership of ProxyAdmin...')
    // The owner of the ProxyAdmin can upgrade our contracts
    await hUHGovernance.connect(proxy01Owner).transferProxyOwnership(gnosisSafe)
    console.log('Transferred ownership of ProxyAdmin to:', gnosisSafe)
  }
}
export default func
func.tags = ['HUHGovernance']
module.exports.dependencies = ['Timestamp', 'ERC20Mock']
