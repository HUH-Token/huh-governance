import { rawDeploy, Timestamp, waffle, ethers } from './mainDeploy'
import { stringify } from 'flatted'
const fs = require('fs')

const deployMe = async () => {
  const LOCK_TIME = 24 * 60 * 60
  const TOKEN_NAME = 'Test Token'
  const TOKEN_SYMBOL = 'TST'
  const TOKEN = { NAME: TOKEN_NAME, SYMBOL: TOKEN_SYMBOL }
  const SafeERC20 = await ethers.getContractFactory('@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol:SafeERC20')
  const safeERC20 = SafeERC20.attach('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174')
  const constants = { LOCK_TIME, TOKEN }
  const [first, second, third, fourth] = await ethers.getSigners()
  const timestamp = await waffle.deployContract(first, Timestamp)
  return await rawDeploy(timestamp, safeERC20, [first, second, third, fourth], constants)
}

const main = async () => {
  const deploy = await deployMe()
  const deployString = stringify(deploy)
  fs.writeFileSync('deploy.json', deployString)
  // const readDeployString = fs.readFileSync('deploy.json')
  // const readDeploy = parse(readDeployString)
  // expect(deploy.acceptedToken.address)
  //   .to.be.equal(readDeploy.acceptedToken.address)
  // expect(deploy.first.address)
  //   .to.be.equal(readDeploy.first.address)
  // expect(deploy.second.address)
  //   .to.be.equal(readDeploy.second.address)
  // expect(deploy.third.address)
  //   .to.be.equal(readDeploy.third.address)
  // expect(deploy.yieldFarming.address)
  //   .to.be.equal(readDeploy.yieldFarming.address)
  // expect(deploy.yieldFarmingToken.address)
  //   .to.be.equal(readDeploy.yieldFarmingToken.address)
  // expect(deploy.timestamp.address)
  //   .to.be.equal(readDeploy.timestamp.address)
  // expect(deploy.payees)
  //   .to.be.deep.equal(readDeploy.payees)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
