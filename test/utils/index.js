import { ethers } from 'hardhat'
export async function setupUsers (addresses, contracts) {
  const users = []
  for (const address of addresses) {
    users.push(await setupUser(address, contracts))
  }
  return users
}
export async function setupUser (address, contracts) {
  const user = { address }
  for (const key of Object.keys(contracts)) {
    user[key] = contracts[key].connect(await ethers.getSigner(address))
  }
  return user
}
