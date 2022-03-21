import { expect } from './utils/chai-setup'
import { setupUsers, connectAndGetNamedAccounts } from '../src/signers'

const setup = async () => {
  await deployments.fixture(['ERC20Mock', 'Timestamp', 'HUHGovernance'])
  const contracts = {
    HUHGovernance: (await ethers.getContract('HUHGovernance'))
  }
  const namedAccounts = await connectAndGetNamedAccounts(contracts)
  // get fet unnammedAccounts (which are basically all accounts not named in the config, useful for tests as you can be sure they do not have been given token for example)
  // we then use the utilities function to generate user object/
  // These object allow you to write things like `users[0].Token.transfer(....)`
  const users = await setupUsers(await getUnnamedAccounts(), contracts)
  // finally we return the whole object (including the tokenOwner setup as a User object)
  return {
    ...contracts,
    users,
    ...namedAccounts
  }
}

describe('HUHGovernance contract - Administration', () => {
  let deploy = {}
  beforeEach(async () => {
    deploy = await setup()
  })
  it('Ownership transfer', async () => {
    const firstOwner = await deploy.HUHGovernance.owner()
    expect(firstOwner).to.equal(deploy.deployer.address)
    await expect(deploy.HUHGovernance.connect(deploy.deployer).transferOwnership(deploy.tokenOwner.address))
      .to.emit(deploy.HUHGovernance, 'OwnershipTransferred')
      .withArgs(deploy.deployer.address, deploy.tokenOwner.address)
    const secondOwner = await deploy.HUHGovernance.owner()
    expect(secondOwner).to.equal(deploy.tokenOwner.address)
  })
})
