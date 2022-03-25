import {
  getImplementationAddress
} from '@openzeppelin/upgrades-core'

const getImplementation = async (contract) => {
  const implementation = await getImplementationAddress(hre.network.provider, contract.address)
  return implementation
}

export { getImplementation }
