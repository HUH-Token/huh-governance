const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer, tokenOwner } = await getNamedAccounts()
  await deploy('Token', {
    from: deployer,
    args: [tokenOwner],
    log: true
  })
}
export default func
func.tags = ['Token']
