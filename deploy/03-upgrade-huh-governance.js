import { getImplementation } from './../src/getImplementation'

const func = async (hre) => {
  // eslint-disable-next-line no-undef
  const { deploy } = deployments
  // eslint-disable-next-line no-undef
  const { proxy01Owner } = await getNamedAccounts()
  // eslint-disable-next-line no-undef
  const timestampContract = await deployments.get('Timestamp')
  // eslint-disable-next-line no-undef
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  // eslint-disable-next-line no-undef
  const tokenContract = await deployments.get('Token')
  // eslint-disable-next-line no-undef
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach(tokenContract.address)
  const huhGovernance = await ethers.getContractAt('HUHGovernance', (await deployments.get('HUHGovernance')).address)

  const previousImplementation = await getImplementation(huhGovernance)
  console.log(`Previous implementation: ${previousImplementation}`)
  // const implAddress = ethers.utils.hexStripZeros(implHex);
  // console.log(implAddress);

  await deploy('HUHGovernance', {
    contract: 'HUHGovernance_V2',
    from: proxy01Owner,
    args: [
      safeERC20.address,
      timestamp.address,
      50 // Maximum lock time in years
    ],
    proxy: {
      proxyContract: 'ERC1967Proxy',
      proxyArgs: ['{implementation}', '{data}'],
      execute: {
        onUpgrade: {
          methodName: 'onUpgrade',
          args: [
            previousImplementation
          ]
        }
      }
    },
    log: true
  })

  const newImplementation = await getImplementation(huhGovernance)
  console.log(`New implementation: ${newImplementation}`)
}
export default func
func.tags = ['HUHGovernance_V2']
module.exports.dependencies = ['HUHGovernance']
