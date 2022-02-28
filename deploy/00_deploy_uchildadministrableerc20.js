const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  await deploy('UChildAdministrableERC20', {
    from: deployer,
    proxy: true,
    log: true
  })
}
export default func
func.tags = ['UChildAdministrableERC20']
