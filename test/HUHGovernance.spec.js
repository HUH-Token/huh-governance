import { expect } from './utils/chai-setup'
import Timestamp from '../artifacts/contracts/Timestamp.sol/Timestamp.json'
import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from '../src/signers'
import { upgrade } from '../src/upgrade'

// const setup = async () => {
//   await deployments.fixture(['Token', 'Timestamp', 'HUHGovernance'])
//   const contracts = {
//     HUHGovernance: (await ethers.getContract('HUHGovernance'))
//   }
//   const namedAccounts = await connectAndGetNamedAccounts(contracts)
//   // get fet unnammedAccounts (which are basically all accounts not named in the config, useful for tests as you can be sure they do not have been given token for example)
//   // we then use the utilities function to generate user object/
//   // These object allow you to write things like `users[0].Token.transfer(....)`
//   const users = await setupUsers(await getUnnamedAccounts(), contracts)
//   // finally we return the whole object (including the tokenOwner setup as a User object)
//   return {
//     ...contracts,
//     users,
//     ...namedAccounts
//   }
// }

const calculateYearsDeltaTime = (years) => {
  return (((years * 3652425 + 5000) / 10000) * 24 * 60 * 60)
}

const mockedDeployFixture = deployments.createFixture(async () => {
  // await deployments.fixture(); // ensure you start from a fresh deployments
  const { deploy } = deployments
  await deployments.fixture(['ERC20Mock'])
  const LOCK_TIME = 1
  const INITIAL_BALANCE = 1000
  const FREEZE_AMOUNT = INITIAL_BALANCE / 10
  const DEPLOY_TIMESTAMP = 1
  const DEPOSIT_TIMESTAMP = DEPLOY_TIMESTAMP + 24 * 60 * 60 // one day later
  const UNLOCK_TIMESTAMP = DEPOSIT_TIMESTAMP + 24 * 60 * 60 // one day later
  const TIMESTAMPS = { DEPLOY: DEPLOY_TIMESTAMP, DEPOSIT: DEPOSIT_TIMESTAMP, UNLOCK: UNLOCK_TIMESTAMP }
  const TOKEN_NAME = 'A Token name'
  const TOKEN_SYMBOL = 'A Token symbol'
  const TOKEN = { NAME: TOKEN_NAME, SYMBOL: TOKEN_SYMBOL }
  const constants = { LOCK_TIME, INITIAL_BALANCE, FREEZE_AMOUNT, TIMESTAMPS, TOKEN }
  const namedSigners = await getNamedSigners()
  // let timestamp = await waffle.deployContract(first, Timestamp)
  const timestamp = await waffle.deployMockContract(namedSigners.deployer, Timestamp.abi)
  await timestamp.mock.getTimestamp.returns(constants.TIMESTAMPS.DEPLOY)
  await timestamp.mock.caculateYearsDeltatime.withArgs(50).returns(calculateYearsDeltaTime(50))
  expect(await timestamp.getTimestamp()).to.be.bignumber.equal(constants.TIMESTAMPS.DEPLOY)
  const acceptedToken = await ethers.getContract('ERC20Mock')
  await acceptedToken.increaseAllowance(namedSigners.deployer.address, constants.FREEZE_AMOUNT)
  await acceptedToken.connect(namedSigners.deployer).transfer(namedSigners.tokenOwner.address, constants.FREEZE_AMOUNT)
  await deploy('HUHGovernance', {
    contract: 'HUHGovernance',
    from: namedSigners.deployer.address,
    args: [
      acceptedToken.address,
      timestamp.address,
      50 // Maximum lock time in years
    ],
    proxy: {
      proxyContract: 'ERC1967Proxy',
      proxyArgs: ['{implementation}', '{data}'],
      execute: {
        init: {
          methodName: 'init',
          args: [
            namedSigners.proxy01Owner.address,
            acceptedToken.address,
            timestamp.address,
            50 // Maximum lock time in years
          ]
        }
      }
    },
    log: true
  })
  const hUHGovernance = await ethers.getContractAt('HUHGovernance', (await deployments.get('HUHGovernance')).address)
  return {
    constants,
    ...namedSigners,
    acceptedToken,
    timestamp,
    hUHGovernance
  }
})
const makeSuite = (votingQualityMultiplier, callback, additionalTests) => {
  describe('Freeze', () => {
    let depositValue
    beforeEach(async () => {
      depositValue = this.constants.FREEZE_AMOUNT
      await this.acceptedToken.connect(this.deployer).increaseAllowance(this.hUHGovernance.address, depositValue)
    })
    additionalTests()
    describe('General tests', async () => {
      beforeEach(async () => {
        await callback()
      })
      it('Ownership transfer', async () => {
        const firstOwner = await this.hUHGovernance.owner()
        expect(firstOwner).to.equal(this.deployer.address)
        await expect(this.hUHGovernance.connect(this.deployer).transferOwnership(this.tokenOwner.address))
          .to.emit(this.hUHGovernance, 'OwnershipTransferred')
          .withArgs(this.deployer.address, this.tokenOwner.address)
        const secondOwner = await this.hUHGovernance.owner()
        expect(secondOwner).to.equal(this.tokenOwner.address)
      })
      it('Get Proxy Admin', async () => {
        const proxyAdmin = await this.hUHGovernance.getProxyAdmin()
        expect(proxyAdmin).to.equal(this.proxy01Owner.address)
      })
      describe('Proxy Ownership transfer', async () => {
        let firstProxyAdmin
        beforeEach(async () => {
          firstProxyAdmin = await this.hUHGovernance.getProxyAdmin()
        })
        it('Should succeed from ProxyAdmin', async () => {
          expect(firstProxyAdmin).to.equal(this.proxy01Owner.address)
          await expect(this.hUHGovernance.connect(this.proxy01Owner).transferProxyOwnership(this.deployer.address))
            .to.emit(this.hUHGovernance, 'ProxyOwnershipTransferred')
            .withArgs(this.proxy01Owner.address, this.deployer.address)
          const secondProxyAdmin = await this.hUHGovernance.getProxyAdmin()
          expect(secondProxyAdmin).to.equal(this.deployer.address)
        })
        it('Should revert if attempt to transfer from non ProxyAdmin account', async () => {
          expect(firstProxyAdmin).to.equal(this.proxy01Owner.address)
          await expect(this.hUHGovernance.connect(this.deployer).transferProxyOwnership(this.deployer.address))
            .to.be.revertedWith('NOT_AUTHORIZED')
        })
      })
      it('Calculate right zero votingy quality', async () => {
        const initialVotingQuality = await this.hUHGovernance.calculateMyVotingQuality()
        expect(initialVotingQuality).to.be.equal(0)
      })
      it('TokenTimeLock: release time is before current time', async () => {
        const forHowLong = 0
        await this.timestamp.mock.getTimestamp.returns(this.constants.TIMESTAMPS.DEPLOY - 1)
        await expect(this.hUHGovernance.freezeMyHuhTokens(depositValue, forHowLong))
          .to.be.revertedWith('TokenTimeLock: release time is before current time')
      })
      it('Emit FrozenHuhTokens when freezing for a third party', async () => {
        await this.acceptedToken.connect(this.tokenOwner).increaseAllowance(this.hUHGovernance.address, depositValue)
        const forHowLong = await this.timestamp.caculateYearsDeltatime(50)
        await expect(this.hUHGovernance.connect(this.deployer).freezeHuhTokens(this.tokenOwner.address, depositValue, forHowLong))
          .to.emit(this.hUHGovernance, 'FrozenHuhTokens')
          .withArgs(this.tokenOwner.address, depositValue, forHowLong)
      })
      it('Emit FrozenHuhTokens', async () => {
        const forHowLong = await this.timestamp.caculateYearsDeltatime(50)
        await expect(this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(depositValue, forHowLong))
          .to.emit(this.hUHGovernance, 'FrozenHuhTokens')
          .withArgs(this.deployer.address, depositValue, forHowLong)
      })
      it('Revert when trying to freeze a null value.', async () => {
        const forHowLong = await this.timestamp.caculateYearsDeltatime(50)
        await expect(this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(0, forHowLong))
          .to.be.revertedWith('Too low amount!')
      })
      it('Revert when trying to freeze for longer than 50 years.', async () => {
        await this.timestamp.mock.caculateYearsDeltatime.withArgs(51).returns(calculateYearsDeltaTime(51))
        const forHowLong = await this.timestamp.caculateYearsDeltatime(51)
        await expect(this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(0, forHowLong))
          .to.be.revertedWith('Too long lockTime!')
      })
    })
    describe('After Staking', async () => {
      let forHowLong
      beforeEach(async () => {
        forHowLong = await this.timestamp.caculateYearsDeltatime(50)
        await this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(depositValue, forHowLong)
      })
      describe('Then upgrade', async () => {
        beforeEach(async () => {
          await callback()
        })
        it('Owner should be able to get list of token time locks', async () => {
          const list = await this.hUHGovernance.connect(this.deployer).getListOfTokenTimeLocks()
          expect(list.length).to.be.equal(1)
          const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', list[0])
          expect(await tokenTimeLock.beneficiary())
            .to.be.equal(this.deployer.address)
        })
        it('Non owner should not be able to get list of token time locks', async () => {
          await expect(this.hUHGovernance.connect(this.proxy01Owner).getListOfTokenTimeLocks())
            .to.be.revertedWith('Ownable: caller is not the owner')
        })
      })
      describe('Owners\'s tests', async () => {
        beforeEach(async () => {
          await this.acceptedToken.connect(this.tokenOwner).increaseAllowance(this.hUHGovernance.address, depositValue)
          await this.hUHGovernance.connect(this.tokenOwner).freezeMyHuhTokens(depositValue, forHowLong)
          await callback()
        })
        describe('Calculate others\' voting quality', async () => {
          it('Owner should be entitled', async () => {
            await this.hUHGovernance.connect(this.deployer).calculateVotingQuality(this.tokenOwner.address)
          })
          it('Non owners should not be entitled', async () => {
            await expect(this.hUHGovernance.connect(this.tokenOwner).calculateVotingQuality(this.deployer.address))
              .to.be.revertedWith('Ownable: caller is not the owner')
          })
        })
        describe('Get others\' token time lock', async () => {
          it('Owner should be entitled', async () => {
            await this.hUHGovernance.connect(this.deployer).getTokenTimeLock(this.tokenOwner.address, 0)
          })
          it('Non owners should not be entitled', async () => {
            await expect(this.hUHGovernance.connect(this.tokenOwner).getTokenTimeLock(this.deployer.address, 0))
              .to.be.revertedWith('Ownable: caller is not the owner')
          })
        })
        describe('Get others\' token time locks', async () => {
          it('Owner should be entitled', async () => {
            const timeLocks = await this.hUHGovernance.connect(this.deployer).getTokenTimeLocks(this.tokenOwner.address)
            expect(timeLocks.length).to.be.greaterThan(0)
          })
          it('Non owners should not be entitled', async () => {
            await expect(this.hUHGovernance.connect(this.tokenOwner).getTokenTimeLocks(this.deployer.address))
              .to.be.revertedWith('Ownable: caller is not the owner')
          })
        })
      })
      describe('Check token time lock', async () => {
        let tokenTimeLock
        beforeEach(async () => {
          const myTimeLocks = await this.hUHGovernance.connect(this.deployer).getMyTokenTimeLocks()
          const TokenTimeLock = await ethers.getContractFactory('../artifacts/contracts/TokenTimeLock.sol:TokenTimeLock')
          tokenTimeLock = TokenTimeLock.attach(myTimeLocks[0])
          await callback()
        })
        it('delta time', async () => {
          expect(await tokenTimeLock.deltaTime()).to.be.equal(forHowLong)
        })
        it('amount', async () => {
          expect(await tokenTimeLock.amount()).to.be.equal(this.constants.FREEZE_AMOUNT)
        })
      })
      it('Calculate my voting quality', async () => {
        await callback()
        expect(await this.hUHGovernance.connect(this.deployer).calculateMyVotingQuality())
          .to.be.equal(votingQualityMultiplier * 157789080000)
      })
    })
  })
  describe('Unfreeze tokens', async () => {
    describe('without deposit', async () => {
      it('try release', async () => {
        await callback()
        await expect(this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0))
          .to.be.revertedWith('Index out of bounds!')
      })
      it('try get TokenTimeLock', async () => {
        await callback()
        await expect(this.hUHGovernance.connect(this.deployer).getMyTokenTimeLock(0))
          .to.be.revertedWith('Index out of bounds!')
      })
    })
    describe('with one deposit', async () => {
      let forHowLong
      beforeEach(async () => {
        forHowLong = 24 * 60 * 60
        const depositValue = this.constants.FREEZE_AMOUNT
        await this.acceptedToken.connect(this.deployer).increaseAllowance(this.hUHGovernance.address, depositValue)
        await this.timestamp.mock.getTimestamp.returns(this.constants.TIMESTAMPS.DEPOSIT)
        await this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(depositValue, forHowLong)
      })
      it('before unlock', async () => {
        await callback()
        await expect(this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0))
          .to.be.revertedWith('TokenTimeLock: current time is before release time')
      })
      describe('after unlock', async () => {
        beforeEach(async () => {
          await this.timestamp.mock.getTimestamp.returns(this.constants.TIMESTAMPS.UNLOCK)
        })
        it('Correctly get my token time locks', async () => {
          await callback()
          const tokenTimeLockAddresses = await this.hUHGovernance.connect(this.deployer).getMyTokenTimeLocks()
          await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            expect(await tokenTimeLock.beneficiary())
              .to.be.equal(this.deployer.address)
          }))
        })
        it('revert when trying to directly release', async () => {
          await callback()
          const tokenTimeLockAddresses = await this.hUHGovernance.connect(this.deployer).getMyTokenTimeLocks()
          await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            await expect(tokenTimeLock.release())
              .to.be.revertedWith('Ownable: caller is not the owner')
          }))
        })
        it('Emit UnfrozenHuhTokens', async () => {
          await callback()
          await expect(this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0))
            .to.emit(this.hUHGovernance, 'UnfrozenHuhTokens')
            .withArgs(this.deployer.address, this.constants.FREEZE_AMOUNT, forHowLong)
        })
        it('should be able to get tokenTimeLock from existing index', async () => {
          await callback()
          const tokenTimeLockAddress = await this.hUHGovernance.connect(this.deployer).getMyTokenTimeLock(0)
          const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
          await expect(tokenTimeLock.release())
            .to.be.revertedWith('Ownable: caller is not the owner')
        })
        describe('After unfreezing', async () => {
          let initialVotingQuality
          beforeEach(async () => {
            initialVotingQuality = await this.hUHGovernance.connect(this.deployer).calculateMyVotingQuality()
            await this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0)
          })
          it('Reduce voting quality', async () => {
            await callback()
            const finalVotingQuality = await this.hUHGovernance.connect(this.deployer).calculateMyVotingQuality()
            expect(finalVotingQuality / votingQualityMultiplier).to.be.below(initialVotingQuality)
          })
          it('Owner should be able to get reduced list of token time locks', async () => {
            await callback()
            const list = await this.hUHGovernance.connect(this.deployer).getListOfTokenTimeLocks()
            expect(list.length).to.be.equal(0)
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
        const totalDeposit = this.constants.FREEZE_AMOUNT
        firstDeposit = Math.round(totalDeposit / 3)
        secondDeposit = totalDeposit - firstDeposit
        await this.acceptedToken.connect(this.deployer).increaseAllowance(this.hUHGovernance.address, totalDeposit)
        await this.timestamp.mock.getTimestamp.returns(this.constants.TIMESTAMPS.DEPOSIT)
        await this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(firstDeposit, forHowLong)
        await this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(secondDeposit, forHowLong)
      })
      it('before unlock', async () => {
        await callback()
        await expect(this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0))
          .to.be.revertedWith('TokenTimeLock: current time is before release time')
      })
      describe('after unlock', async () => {
        beforeEach(async () => {
          await this.timestamp.mock.getTimestamp.returns(this.constants.TIMESTAMPS.UNLOCK)
        })
        it('Correctly get my token time locks', async () => {
          await callback()
          const tokenTimeLockAddresses = await this.hUHGovernance.connect(this.deployer).getMyTokenTimeLocks()
          await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            expect(await tokenTimeLock.beneficiary())
              .to.be.equal(this.deployer.address)
          }))
        })
        describe('Should be able to release from each token time lock independently', async () => {
          it('Emit UnfrozenHuhTokens at index 0', async () => {
            await callback()
            await expect(this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0))
              .to.emit(this.hUHGovernance, 'UnfrozenHuhTokens')
              .withArgs(this.deployer.address, firstDeposit, forHowLong)
          })
          it('Emit YieldFarmingTokenRelease at index 1', async () => {
            await callback()
            await expect(this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(1))
              .to.emit(this.hUHGovernance, 'UnfrozenHuhTokens')
              .withArgs(this.deployer.address, secondDeposit, forHowLong)
          })
        })
        describe('After unfreezing', async () => {
          let initialVotingQuality
          beforeEach(async () => {
            initialVotingQuality = await this.hUHGovernance.connect(this.deployer).calculateMyVotingQuality()
            await this.hUHGovernance.connect(this.deployer).unfreezeHuhTokens(0)
          })
          it('Reduce voting quality', async () => {
            await callback()
            const finalVotingQuality = await this.hUHGovernance.connect(this.deployer).calculateMyVotingQuality()
            expect(finalVotingQuality / votingQualityMultiplier).to.be.below(initialVotingQuality)
          })
          it('Owner should be able to get reduced list of token time locks', async () => {
            await callback()
            const list = await this.hUHGovernance.connect(this.deployer).getListOfTokenTimeLocks()
            expect(list.length).to.be.equal(1)
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', list[0])
            expect(await tokenTimeLock.beneficiary())
              .to.be.equal(this.deployer.address)
          })
        })
      })
    })
  })
  it('Should be able to upgrade the smart contract', async () => {
    await callback()
    await upgrade(this)
  })
}
describe('HUHGovernance contract', () => {
  beforeEach(async () => {
    const deploy = await mockedDeployFixture()
    Object.assign(this, deploy)
  })
  describe('Before upgrade', () => {
    makeSuite(1, async () => {}, () => {})
  })
  describe('After upgrade', () => {
    makeSuite(2, async () => {
      await upgrade(this)
    }, () => {
      describe('Basic test', () => {
        let depositValue
        let depositValue2
        let forHowLong
        beforeEach(async () => {
          depositValue = this.constants.FREEZE_AMOUNT
          depositValue2 = this.constants.FREEZE_AMOUNT / 4
          forHowLong = await this.timestamp.caculateYearsDeltatime(50)
          await this.acceptedToken.connect(this.deployer).increaseAllowance(this.hUHGovernance.address, depositValue)
          await this.hUHGovernance.connect(this.deployer).freezeMyHuhTokens(depositValue, forHowLong)
          await this.acceptedToken.connect(this.tokenOwner).increaseAllowance(this.hUHGovernance.address, depositValue2)
          await this.hUHGovernance.connect(this.tokenOwner).freezeMyHuhTokens(depositValue2, forHowLong)
          await upgrade(this)
        })
        it('Calculate my voting quality', async () => {
          expect(await this.hUHGovernance.connect(this.deployer).calculateMyVotingQuality())
            .to.be.equal(315578160000)
          expect(await this.hUHGovernance.connect(this.tokenOwner).calculateMyVotingQuality())
            .to.be.equal(78894540000)
        })
      })
    })
  })
})
