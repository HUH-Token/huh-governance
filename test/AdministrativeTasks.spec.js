import { expect } from './utils/chai-setup'

describe('HUHGovernance contract - Administration', () => {
  const deploy = {}
  beforeEach(async () => {
    await deployments.fixture(['Timestamp', 'UChildAdministrableERC20', 'HUHGovernance', 'DefaultProxyAdmin'])
    const [deployer, first, second, third, fourth] = await ethers.getSigners()
    deploy.defaultProxyAdmin = await ethers.getContract('DefaultProxyAdmin')
    deploy.deployer = deployer
    deploy.first = first
    deploy.second = second
    deploy.third = third
    deploy.fourth = fourth
  })
  it('Ownership transfer', async () => {
    const firstOwner = await deploy.defaultProxyAdmin.owner()
    expect(firstOwner).to.equal(deploy.deployer.address)
    await expect(deploy.defaultProxyAdmin.connect(deploy.deployer).transferOwnership(deploy.second.address))
      .to.emit(deploy.defaultProxyAdmin, 'OwnershipTransferred')
      .withArgs(deploy.deployer.address, deploy.second.address)
    const secondOwner = await deploy.defaultProxyAdmin.owner()
    expect(secondOwner).to.equal(deploy.second.address)
  })
})
