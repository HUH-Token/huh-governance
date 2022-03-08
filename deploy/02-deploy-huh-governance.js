import { ethers } from 'hardhat'

const func = async (hre) => {
  // eslint-disable-next-line no-undef
  const { deploy } = deployments
  // eslint-disable-next-line no-undef
  const { deployer, proxy01Owner } = await getNamedAccounts()
  // eslint-disable-next-line no-undef
  const timestampContract = await deployments.get('Timestamp')
  // eslint-disable-next-line no-undef
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  // eslint-disable-next-line no-undef
  const tokenContract = await deployments.get('Token')
  // eslint-disable-next-line no-undef
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach(tokenContract.address)

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
              proxy01Owner,
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
module.exports.dependencies = ['Timestamp', 'Token']
