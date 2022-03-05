// We import Chai to use its asserting functions here.
import { expect } from './utils/chai-setup'
import Token from '../artifacts/contracts/Token.sol/Token.json'
// we import our utilities
import { setupUsers, setupUser } from './utils'
// We import the hardhat environment field we are planning to use
import { ethers, /* deployments, */ waffle, getNamedAccounts, getUnnamedAccounts } from 'hardhat'
// we create a stup function that can be called by every test and setup variable for easy to read tests
async function setup () {
  // we get the tokenOwner
  const { tokenOwner } = await getNamedAccounts()
  const [first] = await ethers.getSigners()
  const contracts = {
    Token: (await waffle.deployMockContract(first, Token.abi))
  }
  // get fet unnammedAccounts (which are basically all accounts not named in the config, useful for tests as you can be sure they do not have been given token for example)
  // we then use the utilities function to generate user object/
  // These object allow you to write things like `users[0].Token.transfer(....)`
  const users = await setupUsers(await getUnnamedAccounts(), contracts)
  // finally we return the whole object (including the tokenOwner setup as a User object)
  return {
    ...contracts,
    first,
    users,
    tokenOwner: await setupUser(tokenOwner, contracts)
  }
}
// `describe` is a Mocha function that allows you to organize your tests. It's
// not actually needed, but having your tests organized makes debugging them
// easier. All Mocha functions are available in the global scope.
// `describe` receives the name of a section of your test suite, and a callback.
// The callback must define the tests of that section. This callback can't be
// an async function.
describe('Token contract', function () {
  let deploy
  beforeEach(async () => {
    deploy = await setup()
  })
  // You can nest describe calls to create subsections.
  it.only('', async () => {
    await deploy.Token.mock.balanceOf.withArgs(deploy.first.address).returns(5000)
    expect(await deploy.Token.balanceOf(deploy.first.address))
      .to.equal(5000)
  })
})
