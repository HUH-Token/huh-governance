import { ethers } from 'hardhat'

const func = async (hre) => {
  const { deploy } = deployments
  const { deployer/*, proxy01Owner */ } = await getNamedAccounts()
  const timestampContract = await deployments.get('Timestamp')
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  const tokenContract = await deployments.get('ERC20Mock')
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach(tokenContract.address)

  const gnosisSafeAddress = '0x9f01873CE9eD346b2ae76eb36dD98ff0198DF9aA'

  await deploy('HUHGovernance',
    {
      contract: 'HUHGovernance',
      from: deployer,
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
              gnosisSafeAddress,
              safeERC20.address,
              timestamp.address,
              50 // Maximum lock time in years
            ]
          }
        }
      },
      log: true
    })
}
export default func
func.tags = ['HUHGovernance']
module.exports.dependencies = ['Timestamp', 'ERC20Mock']
