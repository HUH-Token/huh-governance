import { ethers } from 'hardhat'

const IMPLEMENTATION_STORAGE = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'

const getImplementation = async (contract) => {
  return await ethers.provider.getStorageAt(
    contract.address,
    IMPLEMENTATION_STORAGE
  )
}
export { getImplementation }
