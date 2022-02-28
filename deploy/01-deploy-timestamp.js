const func = async (hre) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  await deploy('Timestamp', {
    from: deployer,
    args: [],
    log: true
  })
}
export default func
func.tags = ['Timestamp']
