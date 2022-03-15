import { expect } from './utils/chai-setup'
import Timestamp from '../artifacts/contracts/Timestamp.sol/Timestamp.json'
import ERC20Mock from '../artifacts/contracts/ERC20Mock.sol/ERC20Mock.json'
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
  await deployments.fixture(['Token'])
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
  const acceptedToken = await waffle.deployContract(namedSigners.deployer, ERC20Mock, [
    'ERC20Mock name',
    'ERC20Mock symbol',
    namedSigners.deployer.address,
    constants.INITIAL_BALANCE
  ])
  await acceptedToken.transfer(namedSigners.tokenOwner.address, constants.FREEZE_AMOUNT)
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

describe('HUHGovernance contract', () => {
  let deploy
  beforeEach(async () => {
    deploy = await mockedDeployFixture()
  })
  describe('Before upgrade', async () => {
    describe('Freeze', async () => {
      let depositValue
      beforeEach(async () => {
        depositValue = deploy.constants.FREEZE_AMOUNT
        await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, depositValue)
      })
      it('Calculate right zero voting quality', async () => {
        const initialVotingQuality = await deploy.hUHGovernance.calculateMyVotingQuality()
        expect(initialVotingQuality).to.be.equal(0)
      })
      it('TokenTimeLock: release time is before current time', async () => {
        const forHowLong = 0
        await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPLOY - 1)
        await expect(deploy.hUHGovernance.freezeMyHuhTokens(depositValue, forHowLong))
          .to.be.revertedWith('TokenTimeLock: release time is before current time')
      })
      it('Emit FrozenHuhTokens when freezing for a third party', async () => {
        await deploy.acceptedToken.connect(deploy.tokenOwner).increaseAllowance(deploy.hUHGovernance.address, depositValue)
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeHuhTokens(deploy.tokenOwner.address, depositValue, forHowLong))
          .to.emit(deploy.hUHGovernance, 'FrozenHuhTokens')
          .withArgs(deploy.tokenOwner.address, depositValue, forHowLong)
      })
      it('Emit FrozenHuhTokens', async () => {
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong))
          .to.emit(deploy.hUHGovernance, 'FrozenHuhTokens')
          .withArgs(deploy.deployer.address, depositValue, forHowLong)
      })
      it('Revert when trying to freeze a null value.', async () => {
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(0, forHowLong))
          .to.be.revertedWith('Too low amount!')
      })
      it('Revert when trying to freeze for longer than 50 years.', async () => {
        await deploy.timestamp.mock.caculateYearsDeltatime.withArgs(51).returns(calculateYearsDeltaTime(51))
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(51)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(0, forHowLong))
          .to.be.revertedWith('Too long lockTime!')
      })
      // it.only('Revert when trying to release a null deposit', async () => {
      //   const forHowLong = 24 * 60 * 60
      //   await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
      //   await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(0, forHowLong)
      //   await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
      //   await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
      //     .to.be.revertedWith('TokenTimeLock: no tokens to release')
      // })
      describe('After Staking', async () => {
        let forHowLong
        beforeEach(async () => {
          forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong)
        })
        it('Owner should be able to get list of token time locks', async () => {
          const list = await deploy.hUHGovernance.connect(deploy.deployer).getListOfTokenTimeLocks()
          expect(list.length).to.be.equal(1)
          const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', list[0])
          expect(await tokenTimeLock.beneficiary())
            .to.be.equal(deploy.deployer.address)
        })
        it('Non owner should not be able to get list of token time locks', async () => {
          await expect(deploy.hUHGovernance.connect(deploy.proxy01Owner).getListOfTokenTimeLocks())
            .to.be.revertedWith('Ownable: caller is not the owner')
        })
        describe('Owners\'s tests', async () => {
          beforeEach(async () => {
            await deploy.acceptedToken.connect(deploy.tokenOwner).increaseAllowance(deploy.hUHGovernance.address, depositValue)
            await deploy.hUHGovernance.connect(deploy.tokenOwner).freezeMyHuhTokens(depositValue, forHowLong)
          })
          describe('Calculate others\' voting quality', async () => {
            it('Owner should be entitled', async () => {
              await deploy.hUHGovernance.connect(deploy.deployer).calculateVotingQuality(deploy.tokenOwner.address)
            })
            it('Non owners should not be entitled', async () => {
              await expect(deploy.hUHGovernance.connect(deploy.tokenOwner).calculateVotingQuality(deploy.deployer.address))
                .to.be.revertedWith('Ownable: caller is not the owner')
            })
          })
          describe('Get others\' token time lock', async () => {
            it('Owner should be entitled', async () => {
              await deploy.hUHGovernance.connect(deploy.deployer).getTokenTimeLock(deploy.tokenOwner.address, 0)
            })
            it('Non owners should not be entitled', async () => {
              await expect(deploy.hUHGovernance.connect(deploy.tokenOwner).getTokenTimeLock(deploy.deployer.address, 0))
                .to.be.revertedWith('Ownable: caller is not the owner')
            })
          })
          describe('Get others\' token time locks', async () => {
            it('Owner should be entitled', async () => {
              const timeLocks = await deploy.hUHGovernance.connect(deploy.deployer).getTokenTimeLocks(deploy.tokenOwner.address)
              expect(timeLocks.length).to.be.greaterThan(0)
            })
            it('Non owners should not be entitled', async () => {
              await expect(deploy.hUHGovernance.connect(deploy.tokenOwner).getTokenTimeLocks(deploy.deployer.address))
                .to.be.revertedWith('Ownable: caller is not the owner')
            })
          })
        })
        describe('Check token time lock', async () => {
          let tokenTimeLock
          beforeEach(async () => {
            const myTimeLocks = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            const TokenTimeLock = await ethers.getContractFactory('../artifacts/contracts/TokenTimeLock.sol:TokenTimeLock')
            tokenTimeLock = TokenTimeLock.attach(myTimeLocks[0])
          })
          it('delta time', async () => {
            expect(await tokenTimeLock.deltaTime()).to.be.equal(forHowLong)
          })
          it('amount', async () => {
            expect(await tokenTimeLock.amount()).to.be.equal(deploy.constants.FREEZE_AMOUNT)
          })
        })
        it('Calculate my voting quality', async () => {
          expect(await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality())
            .to.be.equal(157789080000)
        })
      })
    })
    describe('Unfreeze tokens', async () => {
      describe('without deposit', async () => {
        it('try release', async () => {
          await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
            .to.be.revertedWith('Index out of bounds!')
        })
        it('try get TokenTimeLock', async () => {
          await expect(deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLock(0))
            .to.be.revertedWith('Index out of bounds!')
        })
      })
      describe('with one deposit', async () => {
        let forHowLong
        beforeEach(async () => {
          forHowLong = 24 * 60 * 60
          const depositValue = deploy.constants.FREEZE_AMOUNT
          await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, depositValue)
          await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong)
        })
        it('before unlock', async () => {
          await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
            .to.be.revertedWith('TokenTimeLock: current time is before release time')
        })
        describe('after unlock', async () => {
          beforeEach(async () => {
            await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
          })
          it('Correctly get my token time locks', async () => {
            const tokenTimeLockAddresses = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
              expect(await tokenTimeLock.beneficiary())
                .to.be.equal(deploy.deployer.address)
            }))
          })
          it('revert when trying to directly release', async () => {
            const tokenTimeLockAddresses = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
              await expect(tokenTimeLock.release())
                .to.be.revertedWith('Ownable: caller is not the owner')
            }))
          })
          it('Emit UnfrozenHuhTokens', async () => {
            await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
              .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
              .withArgs(deploy.deployer.address, deploy.constants.FREEZE_AMOUNT, forHowLong)
          })
          it('should be able to get tokenTimeLock from existing index', async () => {
            const tokenTimeLockAddress = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLock(0)
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            await expect(tokenTimeLock.release())
              .to.be.revertedWith('Ownable: caller is not the owner')
          })
          describe('After unfreezing', async () => {
            let initialVotingQuality
            beforeEach(async () => {
              initialVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              await deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0)
            })
            it('Reduce voting quality', async () => {
              const finalVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              expect(finalVotingQuality).to.be.below(initialVotingQuality)
            })
            it('Owner should be able to get reduced list of token time locks', async () => {
              const list = await deploy.hUHGovernance.connect(deploy.deployer).getListOfTokenTimeLocks()
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
          const totalDeposit = deploy.constants.FREEZE_AMOUNT
          firstDeposit = Math.round(totalDeposit / 3)
          secondDeposit = totalDeposit - firstDeposit
          await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, totalDeposit)
          await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(firstDeposit, forHowLong)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(secondDeposit, forHowLong)
        })
        it('before unlock', async () => {
          await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
            .to.be.revertedWith('TokenTimeLock: current time is before release time')
        })
        describe('after unlock', async () => {
          beforeEach(async () => {
            await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
          })
          it('Correctly get my token time locks', async () => {
            const tokenTimeLockAddresses = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
              expect(await tokenTimeLock.beneficiary())
                .to.be.equal(deploy.deployer.address)
            }))
          })
          describe('Should be able to release from each token time lock independently', async () => {
            it('Emit UnfrozenHuhTokens at index 0', async () => {
              await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
                .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
                .withArgs(deploy.deployer.address, firstDeposit, forHowLong)
            })
            it('Emit YieldFarmingTokenRelease at index 1', async () => {
              await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(1))
                .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
                .withArgs(deploy.deployer.address, secondDeposit, forHowLong)
            })
          })
          describe('After unfreezing', async () => {
            let initialVotingQuality
            beforeEach(async () => {
              initialVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              await deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0)
            })
            it('Reduce voting quality', async () => {
              const finalVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              expect(finalVotingQuality).to.be.below(initialVotingQuality)
            })
            it('Owner should be able to get reduced list of token time locks', async () => {
              const list = await deploy.hUHGovernance.connect(deploy.deployer).getListOfTokenTimeLocks()
              expect(list.length).to.be.equal(1)
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', list[0])
              expect(await tokenTimeLock.beneficiary())
                .to.be.equal(deploy.deployer.address)
            })
          })
        })
      })
    })
    it('Should be able to upgrade the smart contract', async () => {
      await upgrade(deploy)
    })
  })
  describe('After upgrade', async () => {
    let votingQualityMultiplier
    beforeEach(async () => {
      votingQualityMultiplier = 2
    })
    describe('Basic test', async () => {
      let depositValue
      let depositValue2
      let forHowLong
      beforeEach(async () => {
        depositValue = deploy.constants.FREEZE_AMOUNT
        depositValue2 = deploy.constants.FREEZE_AMOUNT / 4
        forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, depositValue)
        await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong)
        await deploy.acceptedToken.connect(deploy.tokenOwner).increaseAllowance(deploy.hUHGovernance.address, depositValue2)
        await deploy.hUHGovernance.connect(deploy.tokenOwner).freezeMyHuhTokens(depositValue2, forHowLong)
        await upgrade(deploy)
      })
      it('Calculate my voting quality', async () => {
        expect(await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality())
          .to.be.equal(315578160000)
        expect(await deploy.hUHGovernance.connect(deploy.tokenOwner).calculateMyVotingQuality())
          .to.be.equal(78894540000)
      })
    })
    describe('Freeze', async () => {
      let depositValue
      beforeEach(async () => {
        depositValue = deploy.constants.FREEZE_AMOUNT
        await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, depositValue)
      })
      it('Calculate right zero voting quality', async () => {
        await upgrade(deploy)
        const initialVotingQuality = await deploy.hUHGovernance.calculateMyVotingQuality()
        expect(initialVotingQuality).to.be.equal(0)
      })
      it('TokenTimeLock: release time is before current time', async () => {
        await upgrade(deploy)
        const forHowLong = 0
        await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPLOY - 1)
        await expect(deploy.hUHGovernance.freezeMyHuhTokens(depositValue, forHowLong))
          .to.be.revertedWith('TokenTimeLock: release time is before current time')
      })
      it('Emit FrozenHuhTokens when freezing for a third party', async () => {
        await upgrade(deploy)
        await deploy.acceptedToken.connect(deploy.tokenOwner).increaseAllowance(deploy.hUHGovernance.address, depositValue)
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeHuhTokens(deploy.tokenOwner.address, depositValue, forHowLong))
          .to.emit(deploy.hUHGovernance, 'FrozenHuhTokens')
          .withArgs(deploy.tokenOwner.address, depositValue, forHowLong)
      })
      it('Emit FrozenHuhTokens', async () => {
        await upgrade(deploy)
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong))
          .to.emit(deploy.hUHGovernance, 'FrozenHuhTokens')
          .withArgs(deploy.deployer.address, depositValue, forHowLong)
      })
      it('Revert when trying to freeze a null value.', async () => {
        await upgrade(deploy)
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(0, forHowLong))
          .to.be.revertedWith('Too low amount!')
      })
      it('Revert when trying to freeze for longer than 50 years.', async () => {
        await upgrade(deploy)
        await deploy.timestamp.mock.caculateYearsDeltatime.withArgs(51).returns(calculateYearsDeltaTime(51))
        const forHowLong = await deploy.timestamp.caculateYearsDeltatime(51)
        await expect(deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(0, forHowLong))
          .to.be.revertedWith('Too long lockTime!')
      })
      // it.only('Revert when trying to release a null deposit', async () => {
      //   const forHowLong = 24 * 60 * 60
      //   await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
      //   await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(0, forHowLong)
      //   await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
      //   await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
      //     .to.be.revertedWith('TokenTimeLock: no tokens to release')
      // })
      describe('After Staking', async () => {
        let forHowLong
        beforeEach(async () => {
          forHowLong = await deploy.timestamp.caculateYearsDeltatime(50)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong)
        })
        it('Owner should be able to get list of token time locks', async () => {
          await upgrade(deploy)
          const list = await deploy.hUHGovernance.connect(deploy.deployer).getListOfTokenTimeLocks()
          expect(list.length).to.be.equal(1)
          const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', list[0])
          expect(await tokenTimeLock.beneficiary())
            .to.be.equal(deploy.deployer.address)
        })
        it('Non owner should not be able to get list of token time locks', async () => {
          await upgrade(deploy)
          await expect(deploy.hUHGovernance.connect(deploy.proxy01Owner).getListOfTokenTimeLocks())
            .to.be.revertedWith('Ownable: caller is not the owner')
        })
        describe('Owners\'s tests', async () => {
          beforeEach(async () => {
            await deploy.acceptedToken.connect(deploy.tokenOwner).increaseAllowance(deploy.hUHGovernance.address, depositValue)
            await deploy.hUHGovernance.connect(deploy.tokenOwner).freezeMyHuhTokens(depositValue, forHowLong)
          })
          describe('Calculate others\' voting quality', async () => {
            it('Owner should be entitled', async () => {
              await upgrade(deploy)
              await deploy.hUHGovernance.connect(deploy.deployer).calculateVotingQuality(deploy.tokenOwner.address)
            })
            it('Non owners should not be entitled', async () => {
              await upgrade(deploy)
              await expect(deploy.hUHGovernance.connect(deploy.tokenOwner).calculateVotingQuality(deploy.deployer.address))
                .to.be.revertedWith('Ownable: caller is not the owner')
            })
          })
          describe('Get others\' token time lock', async () => {
            it('Owner should be entitled', async () => {
              await upgrade(deploy)
              await deploy.hUHGovernance.connect(deploy.deployer).getTokenTimeLock(deploy.tokenOwner.address, 0)
            })
            it('Non owners should not be entitled', async () => {
              await upgrade(deploy)
              await expect(deploy.hUHGovernance.connect(deploy.tokenOwner).getTokenTimeLock(deploy.deployer.address, 0))
                .to.be.revertedWith('Ownable: caller is not the owner')
            })
          })
          describe('Get others\' token time locks', async () => {
            it('Owner should be entitled', async () => {
              await upgrade(deploy)
              const timeLocks = await deploy.hUHGovernance.connect(deploy.deployer).getTokenTimeLocks(deploy.tokenOwner.address)
              expect(timeLocks.length).to.be.greaterThan(0)
            })
            it('Non owners should not be entitled', async () => {
              await upgrade(deploy)
              await expect(deploy.hUHGovernance.connect(deploy.tokenOwner).getTokenTimeLocks(deploy.deployer.address))
                .to.be.revertedWith('Ownable: caller is not the owner')
            })
          })
        })
        describe('Check token time lock', async () => {
          let tokenTimeLock
          beforeEach(async () => {
            const myTimeLocks = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            const TokenTimeLock = await ethers.getContractFactory('../artifacts/contracts/TokenTimeLock.sol:TokenTimeLock')
            tokenTimeLock = TokenTimeLock.attach(myTimeLocks[0])
          })
          it('delta time', async () => {
            await upgrade(deploy)
            expect(await tokenTimeLock.deltaTime()).to.be.equal(forHowLong)
          })
          it('amount', async () => {
            await upgrade(deploy)
            expect(await tokenTimeLock.amount()).to.be.equal(deploy.constants.FREEZE_AMOUNT)
          })
        })
        it('Calculate my voting quality', async () => {
          await upgrade(deploy)
          expect(await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality())
            .to.be.equal(votingQualityMultiplier * 157789080000)
        })
      })
    })
    describe('Unfreeze tokens', async () => {
      describe('without deposit', async () => {
        it('try release', async () => {
          await upgrade(deploy)
          await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
            .to.be.revertedWith('Index out of bounds!')
        })
        it('try get TokenTimeLock', async () => {
          await upgrade(deploy)
          await expect(deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLock(0))
            .to.be.revertedWith('Index out of bounds!')
        })
      })
      describe('with one deposit', async () => {
        let forHowLong
        beforeEach(async () => {
          forHowLong = 24 * 60 * 60
          const depositValue = deploy.constants.FREEZE_AMOUNT
          await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, depositValue)
          await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(depositValue, forHowLong)
        })
        it('before unlock', async () => {
          await upgrade(deploy)
          await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
            .to.be.revertedWith('TokenTimeLock: current time is before release time')
        })
        describe('after unlock', async () => {
          beforeEach(async () => {
            await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
          })
          it('Correctly get my token time locks', async () => {
            await upgrade(deploy)
            const tokenTimeLockAddresses = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
              expect(await tokenTimeLock.beneficiary())
                .to.be.equal(deploy.deployer.address)
            }))
          })
          it('revert when trying to directly release', async () => {
            await upgrade(deploy)
            const tokenTimeLockAddresses = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
              await expect(tokenTimeLock.release())
                .to.be.revertedWith('Ownable: caller is not the owner')
            }))
          })
          it('Emit UnfrozenHuhTokens', async () => {
            await upgrade(deploy)
            await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
              .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
              .withArgs(deploy.deployer.address, deploy.constants.FREEZE_AMOUNT, forHowLong)
          })
          it('should be able to get tokenTimeLock from existing index', async () => {
            await upgrade(deploy)
            const tokenTimeLockAddress = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLock(0)
            const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
            await expect(tokenTimeLock.release())
              .to.be.revertedWith('Ownable: caller is not the owner')
          })
          describe('After unfreezing', async () => {
            let initialVotingQuality
            beforeEach(async () => {
              initialVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              await deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0)
            })
            it('Reduce voting quality', async () => {
              await upgrade(deploy)
              const finalVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              expect(finalVotingQuality).to.be.below(initialVotingQuality)
            })
            it('Owner should be able to get reduced list of token time locks', async () => {
              await upgrade(deploy)
              const list = await deploy.hUHGovernance.connect(deploy.deployer).getListOfTokenTimeLocks()
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
          const totalDeposit = deploy.constants.FREEZE_AMOUNT
          firstDeposit = Math.round(totalDeposit / 3)
          secondDeposit = totalDeposit - firstDeposit
          await deploy.acceptedToken.connect(deploy.deployer).increaseAllowance(deploy.hUHGovernance.address, totalDeposit)
          await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.DEPOSIT)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(firstDeposit, forHowLong)
          await deploy.hUHGovernance.connect(deploy.deployer).freezeMyHuhTokens(secondDeposit, forHowLong)
        })
        it('before unlock', async () => {
          await upgrade(deploy)
          await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
            .to.be.revertedWith('TokenTimeLock: current time is before release time')
        })
        describe('after unlock', async () => {
          beforeEach(async () => {
            await deploy.timestamp.mock.getTimestamp.returns(deploy.constants.TIMESTAMPS.UNLOCK)
          })
          it('Correctly get my token time locks', async () => {
            await upgrade(deploy)
            const tokenTimeLockAddresses = await deploy.hUHGovernance.connect(deploy.deployer).getMyTokenTimeLocks()
            await Promise.all(tokenTimeLockAddresses.map(async tokenTimeLockAddress => {
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', tokenTimeLockAddress)
              expect(await tokenTimeLock.beneficiary())
                .to.be.equal(deploy.deployer.address)
            }))
          })
          describe('Should be able to release from each token time lock independently', async () => {
            it('Emit UnfrozenHuhTokens at index 0', async () => {
              await upgrade(deploy)
              await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0))
                .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
                .withArgs(deploy.deployer.address, firstDeposit, forHowLong)
            })
            it('Emit YieldFarmingTokenRelease at index 1', async () => {
              await upgrade(deploy)
              await expect(deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(1))
                .to.emit(deploy.hUHGovernance, 'UnfrozenHuhTokens')
                .withArgs(deploy.deployer.address, secondDeposit, forHowLong)
            })
          })
          describe('After unfreezing', async () => {
            let initialVotingQuality
            beforeEach(async () => {
              initialVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              await deploy.hUHGovernance.connect(deploy.deployer).unfreezeHuhTokens(0)
            })
            it('Reduce voting quality', async () => {
              await upgrade(deploy)
              const finalVotingQuality = await deploy.hUHGovernance.connect(deploy.deployer).calculateMyVotingQuality()
              expect(finalVotingQuality / votingQualityMultiplier).to.be.below(initialVotingQuality)
            })
            it('Owner should be able to get reduced list of token time locks', async () => {
              await upgrade(deploy)
              const list = await deploy.hUHGovernance.connect(deploy.deployer).getListOfTokenTimeLocks()
              expect(list.length).to.be.equal(1)
              const tokenTimeLock = await ethers.getContractAt('TokenTimeLock', list[0])
              expect(await tokenTimeLock.beneficiary())
                .to.be.equal(deploy.deployer.address)
            })
          })
        })
      })
    })
    it('Should be able to upgrade the smart contract', async () => {
      await upgrade(deploy)
    })
  })
})
