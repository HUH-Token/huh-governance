import { upgrade } from './../src/upgrade'
import { getContract } from '../src/getContract'

// Switch to true to upgrade.
const UPGRADE = false

const func = async (hre) => {
  if (UPGRADE) {
    const timestamp = await getContract('Timestamp')
    const acceptedToken = await getContract('ERC20Mock')
    const hUHGovernance = await getContract('HUHGovernance')

    const deployArtifacts = { acceptedToken, timestamp, hUHGovernance }
    await upgrade(deployArtifacts)
  }
}
export default func
func.tags = ['HUHGovernance_V2']
module.exports.dependencies = ['HUHGovernance']
