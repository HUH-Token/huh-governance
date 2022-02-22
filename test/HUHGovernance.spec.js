import { waffleChai } from '@ethereum-waffle/chai'
import { use, expect } from 'chai'
import { ethers } from 'hardhat'
// eslint-disable-next-line no-unused-vars
import { BN } from '@openzeppelin/test-helpers'
import { mockedDeploy } from '../scripts/mainDeploy'
use(waffleChai)

describe('HUHGovernance contract', () => {
  let deploy
  beforeEach(async () => {
    deploy = await mockedDeploy()
  })
  it('Ownership transfer', async () => {
    const firstOwner = await deploy.hUHGovernance.owner()
    expect(firstOwner).to.equal(deploy.first.address)
    await expect(deploy.hUHGovernance.transferOwnership(deploy.second.address))
      .to.emit(deploy.hUHGovernance, 'OwnershipTransferred')
      .withArgs(deploy.first.address, deploy.second.address)
    const secondOwner = await deploy.hUHGovernance.owner()
    expect(secondOwner).to.equal(deploy.second.address)
  })
  describe('Freeze', async () => {
    let depositValue
    beforeEach(async () => {
      depositValue = deploy.constants.INITIAL_BALANCE
      await deploy.acceptedToken.increaseAllowance(deploy.hUHGovernance.address, depositValue)
    })
    it('TokenTimeLock: release time is before current time', async () => {
      const forHowLong = 0
      await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPLOY - 1)
      await expect(deploy.hUHGovernance.freezeHuhTokens(depositValue, forHowLong))
        .to.be.revertedWith('TokenTimeLock: release time is before current time')
    })
    it('Emit FrozenHuhTokens', async () => {
      const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
      await expect(deploy.hUHGovernance.freezeHuhTokens(depositValue, forHowLong))
        .to.emit(deploy.hUHGovernance, 'FrozenHuhTokens')
        .withArgs(deploy.first.address, depositValue, forHowLong)
    })
    describe('After Staking', async () => {
      let forHowLong
      beforeEach(async () => {
        forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await deploy.hUHGovernance.freezeHuhTokens(depositValue, forHowLong)
      })
      describe('Check token time lock', async () => {
        let tokenTimeLock
        beforeEach(async () => {
          const myTimeLocks = await deploy.hUHGovernance.getMyTokenTimeLocks()
          const TokenTimeLock = await ethers.getContractFactory('../artifacts/contracts/TokenTimeLock.sol:TokenTimeLock')
          tokenTimeLock = TokenTimeLock.attach(myTimeLocks[0])
        })
        it('delta time', async () => {
          expect(await tokenTimeLock.deltaTime()).to.be.equal(forHowLong)
        })
        it('amount', async () => {
          expect(await tokenTimeLock.amount()).to.be.equal(deploy.constants.INITIAL_BALANCE)
        })
      })
    })
  })
})
