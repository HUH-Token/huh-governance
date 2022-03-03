// We import Chai to use its asserting functions here.
import { expect } from './chai-setup'
describe('Timestamp contract', () => {
  const deploy = {}
  beforeEach(async () => {
    // global deployments
    // eslint-disable-next-line no-undef
    await deployments.fixture(['Timestamp'])
    // eslint-disable-next-line no-undef
    const [first] = await ethers.getSigners()
    // eslint-disable-next-line no-undef
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
      .to.be.bignumber.to.be.equal(1577836800)
  })
})
