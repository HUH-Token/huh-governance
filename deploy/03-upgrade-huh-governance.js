import { getImplementation } from './../src/getImplementation'
import { getNamedSigners } from './../src/signers'

const func = async (hre) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()
  const timestampContract = await deployments.get('Timestamp')
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  const tokenContract = await deployments.get('Token')
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach(tokenContract.address)
  const huhGovernance = await ethers.getContractAt('HUHGovernance', (await deployments.get('HUHGovernance')).address)

  const previousImplementation = await getImplementation(huhGovernance)
  console.log(`Previous implementation: ${previousImplementation}`)

  await deploy('HUHGovernance', {
    contract: 'HUHGovernance_V2',
    from: proxy01Owner.address,
    args: [
      safeERC20.address,
      timestamp.address,
      50 // Maximum lock time in years
    ],
    proxy: {
      proxyContract: 'ERC1967Proxy',
      proxyArgs: ['{implementation}', '{data}']
      // execute: {
      //   onUpgrade: {
      //     methodName: 'onUpgrade',
      //     args: [
      //       previousImplementation
      //     ]
      //   }
      // }
    },
    log: true
  })

  const newImplementation = await getImplementation(huhGovernance)
  console.log(`New implementation: ${newImplementation}`)
  const huhGovernanceV1 = await ethers.getContractAt('HUHGovernance', previousImplementation)
  await huhGovernanceV1.connect(deployer).transferOwnership(newImplementation)
  const HUHGovernanceV2Contract = await ethers.getContractFactory('contracts/HUHGovernance_V2.sol:HUHGovernance_V2')
  const hUHGovernanceV2 = HUHGovernanceV2Contract.attach(newImplementation)
  await hUHGovernanceV2.connect(deployer).onUpgrade(previousImplementation)
}
export default func
func.tags = ['HUHGovernance_V2']
module.exports.dependencies = ['HUHGovernance']
