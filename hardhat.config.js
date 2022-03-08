import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-solhint'
import '@openzeppelin/hardhat-upgrades'
import 'solidity-coverage'
import 'hardhat-gas-reporter'

import { nodeUrl, accounts } from './utils/network'
const enableGasReport = !!process.env.ENABLE_GAS_REPORT
const enableProduction = process.env.COMPILE_MODE === 'production'
const config = {
  solidity: {
    compilers: [
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: enableGasReport || enableProduction,
            runs: 200
          }
        }
      },
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: enableGasReport || enableProduction,
            runs: 200
          }
        }
      },
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: enableGasReport || enableProduction,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    rinkeby: {
      url: nodeUrl('rinkeby'),
      accounts: accounts('rinkeby')
    },
    ganache: {
      url: nodeUrl('localhost'),
      accounts: accounts('localhost')
    }
  },
  namedAccounts: {
    deployer: 2,
    tokenOwner: 1,
    proxy01Owner: 0
  },
  paths: {
    sources: 'contracts'
  }
}
export default config
