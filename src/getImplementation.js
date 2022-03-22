import { ethers } from 'hardhat'

const IMPLEMENTATION_STORAGE = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
const regexPattern = /(?<=0x000000000000000000000000).{40}/gm
const regexp = new RegExp(regexPattern)

const getImplementation = async (contract) => {
  const stored = await ethers.provider.getStorageAt(
    contract.address,
    IMPLEMENTATION_STORAGE
  )
  // The following is still needed for hardhat network.
  if (stored.length > 42) { return `0x${stored.match(regexp)}` }

  return stored
}
export { getImplementation }
