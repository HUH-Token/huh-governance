import { getNamedSigners } from '../src/signers'

const func = async (hre) => {
  const { deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedSigners()
  await deploy('ERC20Mock', {
    from: deployer.address,
    args: [
      'My Hardhat Token',
      'MBT',
      deployer.address,
      1000
    ],
    log: true
  })
}
export default func
func.tags = ['ERC20Mock']
