const getContract = async (contractString) => {
  const contractInstance = await ethers.getContractAt(contractString, (await deployments.get(contractString)).address)
  return contractInstance
}

export { getContract }
