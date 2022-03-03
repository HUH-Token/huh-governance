import { waffleChai } from '@ethereum-waffle/chai'
import { ethers, waffle } from 'hardhat'
import { use, expect } from 'chai'
// eslint-disable-next-line no-unused-vars
import { BN } from '@openzeppelin/test-helpers'

// import '../test/chai-setup'

import HUHGovernance from '../artifacts/contracts/HUHGovernance.sol/HUHGovernance.json'
import ERC20Mock from '../artifacts/contracts/ERC20Mock.sol/ERC20Mock.json'
import Timestamp from '../artifacts/contracts/Timestamp.sol/Timestamp.json'
use(waffleChai)
// use(waffleChai)

const mockedDeploy = async () => {
  const LOCK_TIME = 1
  const INITIAL_BALANCE = 1000
  const DEPLOY_TIMESTAMP = 1
  const DEPOSIT_TIMESTAMP = DEPLOY_TIMESTAMP + 24 * 60 * 60 // one day later
  const UNLOCK_TIMESTAMP = DEPOSIT_TIMESTAMP + 24 * 60 * 60 // one day later
  const TIMESTAMPS = { DEPLOY: DEPLOY_TIMESTAMP, DEPOSIT: DEPOSIT_TIMESTAMP, UNLOCK: UNLOCK_TIMESTAMP }
  const TOKEN_NAME = 'A Token name'
  const TOKEN_SYMBOL = 'A Token symbol'
  const TOKEN = { NAME: TOKEN_NAME, SYMBOL: TOKEN_SYMBOL }
  const constants = { LOCK_TIME, INITIAL_BALANCE, TIMESTAMPS, TOKEN }
  const [first, second, third, fourth] = await ethers.getSigners()
  // let timestamp = await waffle.deployContract(first, Timestamp)
  const timestamp = await waffle.deployMockContract(first, Timestamp.abi)
  await timestamp.mock.getTimestamp.returns(constants.TIMESTAMPS.DEPLOY)
  await timestamp.mock.caculateYearsDeltatime.returns(((50 * 3652425 + 5000) / 10000) * 24 * 60 * 60)
  expect(await timestamp.getTimestamp()).to.be.bignumber.equal(constants.TIMESTAMPS.DEPLOY)
  const acceptedToken = await waffle.deployContract(first, ERC20Mock, [
    'ERC20Mock name',
    'ERC20Mock symbol',
    first.address,
    constants.INITIAL_BALANCE])
  return await rawDeploy(timestamp, acceptedToken, [first, second, third, fourth], constants)
}

const rawDeploy = async (timestamp, acceptedToken, accounts, constants) => {
  const [first, second, third, fourth] = accounts
  const hUHGovernance = await waffle.deployContract(first, HUHGovernance, [
    acceptedToken.address,
    timestamp.address,
    await timestamp.caculateYearsDeltatime(50)
  ])
  return { hUHGovernance, acceptedToken, first, second, third, fourth, timestamp, constants }
}

export { mockedDeploy, rawDeploy, Timestamp, waffle, expect, ethers }
