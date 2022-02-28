const func = async (hre) => {
  // eslint-disable-next-line no-undef
  const { deploy } = deployments
  // eslint-disable-next-line no-undef
  const { deployer } = await getNamedAccounts()
  // eslint-disable-next-line no-undef
  const timestampContract = await deployments.get('Timestamp')
  // eslint-disable-next-line no-undef
  const timestamp = await ethers.getContractAt('Timestamp', timestampContract.address)
  // eslint-disable-next-line no-undef
  const uChildERC20ProxyContract = await deployments.get('UChildAdministrableERC20_Proxy')
  // eslint-disable-next-line no-undef
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach(uChildERC20ProxyContract.address)

  await deploy('HUHGovernance', {
    from: deployer,
    proxy: {
      execute: {
        methodName: 'initialize',
        args: [
          safeERC20.address,
          timestamp.address,
          50 // Maximum lock time in years
        ]
      }
    },
    log: true
  })
}
export default func
func.tags = ['HUHGovernance']
module.exports.dependencies = ['Timestamp', 'ERC20Mock'] // this ensures the ABDKMathQuad script above is executed shield, so `deployments.get('ABDKMathQuad')` succeeds
