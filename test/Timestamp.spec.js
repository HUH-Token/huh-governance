import { waffleChai } from '@ethereum-waffle/chai'
import { waffle, ethers } from 'hardhat'
import { use, expect } from 'chai'
import Timestamp from '../artifacts/contracts/Timestamp.sol/Timestamp.json'
// eslint-disable-next-line no-unused-vars
import { BN } from '@openzeppelin/test-helpers'
use(waffleChai)

describe('Timestamp contract', () => {
  const deploy = {}
  beforeEach(async () => {
    // // eslint-disable-next-line no-unused-vars
    const [first] = await ethers.getSigners()
    deploy.timestamp = await waffle.deployContract(first, Timestamp)
    deploy.first = first
  })
  it('Gets correctly the timestamp', async () => {
    const unixTime = Math.floor(Date.now() / 1000)
    expect(await deploy.timestamp.getTimestamp())
      .to.be.bignumber.to.be.within(unixTime - 1000, unixTime + 1000)
  })
  it('Calculates correctly years deltatime', async () => {
    expect(await deploy.timestamp.caculateYearsDeltatime(50))
      .to.be.bignumber.to.be.equal(1577836800)
  })
})
