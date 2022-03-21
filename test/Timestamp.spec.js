// We import Chai to use its asserting functions here.
import { expect } from './utils/chai-setup'
describe('Timestamp contract', () => {
  const deploy = {}
  beforeEach(async () => {
    await deployments.fixture(['Timestamp'])
    const [first] = await ethers.getSigners()
    deploy.timestamp = await ethers.getContract('Timestamp')
    deploy.first = first
  })
  it('Gets correctly the timestamp', async () => {
    const unixTime = Math.floor(Date.now() / 1000)
    expect(await deploy.timestamp.getTimestamp())
      .to.be.within(unixTime - 1000, unixTime + 1000)
  })
  it('Calculates correctly years deltatime', async () => {
    expect(await deploy.timestamp.caculateYearsDeltatime(50))
      .to.be.bignumber.to.be.equal(1577847600)
  })
})
