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
  // it.only('', async () => {
  //   const tokenTimeLocks = await deploy.hUHGovernance.getMyTokenTimeLocks()
  //   console.log(tokenTimeLocks)
  // })
  describe('Freeze', async () => {
    let depositValue
    beforeEach(async () => {
      depositValue = deploy.constants.INITIAL_BALANCE
      await deploy.acceptedToken.increaseAllowance(deploy.hUHGovernance.address, depositValue)
    })
    it('Calculate right zero voting quality', async () => {
      const initialVotingQuality = await deploy.hUHGovernance.calculateMyVotingQuality()
      expect(initialVotingQuality).to.be.equal(0)
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
      it('Calculate my voting quality', async () => {
        expect(await deploy.hUHGovernance.calculateMyVotingQuality())
          .to.be.equal(1577890800000)
      })
    })
  })
  describe('Unfreeze tokens', async () => {
    describe('without deposit', async () => {
      it('try release', async () => {
        await expect(deploy.hUHGovernance.unfreezeHuhTokens(0))
          .to.be.revertedWith('Index out of bounds!')
      })
      it('try get TokenTimeLock', async () => {
        await expect(deploy.hUHGovernance.getMyTokenTimeLock(0))
          .to.be.revertedWith('Index out of bounds!')
      })
    })
    describe('with one deposit', async () => {
      let forHowLong
      beforeEach(async () => {
        forHowLong = 24 * 60 * 60
        const depositValue = deploy.constants.INITIAL_BALANCE
        await deploy.acceptedToken.increaseAllowance(deploy.hUHGovernance.address, depositValue)
        await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
        await deploy.hUHGovernance.connect(deploy.first).freezeHuhTokens(depositValue, forHowLong)
      })
      it('before unlock', async () => {
        await expect(deploy.hUHGovernance.unfreezeHuhTokens(0))
          .to.be.revertedWith('TokenTimeLock: current time is before release time')
      })
      describe('after unlock', async () => {
        beforeEach(async () => {
          await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
        })
        it('Correctly get my token time locks', async () => {
          const tokenTimeLockAddresses = await deploy.hUHGovernance.getMyTokenTimeLocks()
          await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            expect(await tokenTimeLock.beneficiary())
              .to.be.equal(deploy.first.address)
          }))
        })
        it('revert when trying to directly release', async () => {
          const tokenTimeLockAddresses = await deploy.hUHGovernance.getMyTokenTimeLocks()
          await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            await expect(tokenTimeLock.release())
              .to.be.revertedWith('Ownable: caller is not the owner')
          }))
        })
        it('Emit UnfrozenHuhTokens', async () => {
          await expect(deploy.hUHGovernance.unfreezeHuhTokens(0))
            .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
            .withArgs(deploy.first.address, deploy.constants.INITIAL_BALANCE, forHowLong)
        })
        it('should be able to get tokenTimeLock from existing index', async () => {
          const tokenTimeLockAddress = await deploy.hUHGovernance.getMyTokenTimeLock(0)
          const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
          await expect(tokenTimeLock.release())
            .to.be.revertedWith('Ownable: caller is not the owner')
        })
        describe('After unfreezing', async () => {
          let initialVotingQuality
          beforeEach(async () => {
            initialVotingQuality = await deploy.hUHGovernance.calculateMyVotingQuality()
            await deploy.hUHGovernance.unfreezeHuhTokens(0)
          })
          it('Reduce voting quality', async () => {
            const finalVotingQuality = await deploy.hUHGovernance.calculateMyVotingQuality()
            expect(finalVotingQuality).to.be.below(initialVotingQuality)
          })
        })
      })
    })
    describe('with two deposits', async () => {
      let forHowLong
      let firstDeposit
      let secondDeposit
      beforeEach(async () => {
        forHowLong = 24 * 60 * 60
        const totalDeposit = deploy.constants.INITIAL_BALANCE
        firstDeposit = Math.round(totalDeposit / 3)
        secondDeposit = totalDeposit - firstDeposit
        await deploy.acceptedToken.increaseAllowance(deploy.hUHGovernance.address, totalDeposit)
        await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
        await deploy.hUHGovernance.connect(deploy.first).freezeHuhTokens(firstDeposit, forHowLong)
        await deploy.hUHGovernance.connect(deploy.first).freezeHuhTokens(secondDeposit, forHowLong)
      })
      it('before unlock', async () => {
        await expect(deploy.hUHGovernance.unfreezeHuhTokens(0))
          .to.be.revertedWith('TokenTimeLock: current time is before release time')
      })
      describe('after unlock', async () => {
        beforeEach(async () => {
          await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
        })
        it('Correctly get my token time locks', async () => {
          const tokenTimeLockAddresses = await deploy.hUHGovernance.getMyTokenTimeLocks()
          await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            expect(await tokenTimeLock.beneficiary())
              .to.be.equal(deploy.first.address)
          }))
        })
        describe('Should be able to release from each token time lock independently', async () => {
          it('Emit UnfrozenHuhTokens at index 0', async () => {
            await expect(deploy.hUHGovernance.unfreezeHuhTokens(0))
              .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
              .withArgs(deploy.first.address, firstDeposit, forHowLong)
          })
          it('Emit YieldFarmingTokenRelease at index 1', async () => {
            await expect(deploy.hUHGovernance.unfreezeHuhTokens(1))
              .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
              .withArgs(deploy.first.address, secondDeposit, forHowLong)
          })
        })
      })
    })
  })
})
