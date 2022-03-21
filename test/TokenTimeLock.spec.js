import { expect } from './utils/chai-setup'
import Timestamp from '../artifacts/contracts/Timestamp.sol/Timestamp.json'
import ERC20Mock from '../artifacts/contracts/ERC20Mock.sol/ERC20Mock.json'
import TokenTimeLock from '../artifacts/contracts/TokenTimeLock.sol/TokenTimeLock.json'
import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from '../src/signers'

const mockedDeployFixture = deployments.createFixture(async () => {
  // await deployments.fixture(); // ensure you start from a fresh deployments
  // const { deploy } = deployments
  await deployments.fixture(['Token'])
  const LOCK_TIME = 1
  const INITIAL_BALANCE = 1000
  const DEPLOY_TIMESTAMP = 1
  const DELTA_TIME = 24 * 60 * 60
  const DEPOSIT_TIMESTAMP = DEPLOY_TIMESTAMP + DELTA_TIME // one day later
  const UNLOCK_TIMESTAMP = DEPOSIT_TIMESTAMP + DELTA_TIME // one day later
  const TIMESTAMPS = { DEPLOY: DEPLOY_TIMESTAMP, DEPOSIT: DEPOSIT_TIMESTAMP, UNLOCK: UNLOCK_TIMESTAMP }
  const TOKEN_NAME = 'A Token name'
  const TOKEN_SYMBOL = 'A Token symbol'
  const TOKEN = { NAME: TOKEN_NAME, SYMBOL: TOKEN_SYMBOL }
  const constants = { LOCK_TIME, INITIAL_BALANCE, TIMESTAMPS, TOKEN, DELTA_TIME }
  const namedSigners = await getNamedSigners()
  // let timestamp = await waffle.deployContract(first, Timestamp)
  const timestamp = await waffle.deployMockContract(namedSigners.deployer, Timestamp.abi)
  await timestamp.mock.getTimestamp.returns(constants.TIMESTAMPS.DEPLOY)
  await timestamp.mock.caculateYearsDeltatime.withArgs(50).returns(((50 * 3652425 + 5000) / 10000) * 24 * 60 * 60)
  expect(await timestamp.getTimestamp()).to.be.bignumber.equal(constants.TIMESTAMPS.DEPLOY)
  const acceptedToken = await waffle.deployContract(namedSigners.deployer, ERC20Mock, [
    'ERC20Mock name',
    'ERC20Mock symbol',
    namedSigners.deployer.address,
    constants.INITIAL_BALANCE
  ])
  const tokenTimeLock = await waffle.deployContract(namedSigners.deployer, TokenTimeLock, [
    timestamp.address,
    acceptedToken.address,
    namedSigners.deployer.address,
    constants.DELTA_TIME,
    0
  ])
  return {
    constants,
    ...namedSigners,
    acceptedToken,
    timestamp,
    tokenTimeLock
  }
})

describe('TokenTimeLock contract', () => {
  let deploy
  beforeEach(async () => {
    deploy = await mockedDeployFixture()
  })
  it('Revert when trying to release without a deposit', async () => {
    await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
    await expect(deploy.tokenTimeLock.connect(deploy.deployer).release())
      .to.be.revertedWith('TokenTimeLock: no tokens to release')
  })
  describe('With a deposit', async () => {
    let depositAmount
    beforeEach(async () => {
      depositAmount = deploy.constants.INITIAL_BALANCE
      await deploy.acceptedToken.increaseAllowance(deploy.deployer.address, depositAmount)
      await deploy.acceptedToken.transferFrom(deploy.deployer.address, deploy.tokenTimeLock.address, depositAmount)
    })
    it('Should emit ReleasedTokens event', async () => {
      await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
      await expect(deploy.tokenTimeLock.connect(deploy.deployer).release())
        .to.emit(deploy.tokenTimeLock, 'ReleasedTokens')
        .withArgs(deploy.deployer.address, depositAmount, deploy.constants.DELTA_TIME - deploy.constants.TIMESTAMPS.DEPLOY)
    })
  })
})
