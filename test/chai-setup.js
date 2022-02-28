import chaiModule from 'chai'
// import { chaiEthers } from 'chai-ethers'
import { waffleChai } from '@ethereum-waffle/chai'
// eslint-disable-next-line no-unused-vars
import { BN } from '@openzeppelin/test-helpers'
chaiModule.use(waffleChai)
const expect = chaiModule.expect
export { expect }
