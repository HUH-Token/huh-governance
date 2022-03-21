import { upgrade } from './../src/upgrade'

const func = async (hre) => {
  const timestampContract = await deployments.get('Timestamp')
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  const tokenContract = await deployments.get('ERC20Mock')
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const acceptedToken = SafeERC20.attach(tokenContract.address)
  const hUHGovernance = await ethers.getContractAt('HUHGovernance', (await deployments.get('HUHGovernance')).address)

  const deployArtifacts = { acceptedToken, timestamp, hUHGovernance }
  await upgrade(deployArtifacts)
}
export default func
func.tags = ['HUHGovernance_V2']
module.exports.dependencies = ['HUHGovernance']
