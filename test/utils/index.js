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
  const theUser = await ethers.getSigner(address)
  for (const key of Object.keys(contracts)) {
    user[key] = contracts[key].connect(theUser)
  }
  return theUser
}

export async function connectAndGetNamedAccounts (contracts) {
  // we get the tokenOwner
  const acc = await getNamedAccounts()
  const accounts = await Promise.all(Object.entries(acc).map(async (entry) => {
    return {
      [entry[0]]: await setupUser(entry[1], contracts)
    }
  }))
  return (Object.assign(...accounts))
}

export async function getNamedSigners () {
  // we get the tokenOwner
  const acc = await getNamedAccounts()
  const accounts = await Promise.all(Object.entries(acc).map(async (entry) => {
    return {
      [entry[0]]: await ethers.getSigner(entry[1])
    }
  }))
  return (Object.assign(...accounts))
}
