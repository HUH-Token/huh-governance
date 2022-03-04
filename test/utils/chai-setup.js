import chaiModule from 'chai'
import { chaiEthers } from 'chai-ethers'
// eslint-disable-next-line no-unused-vars
import { BN } from '@openzeppelin/test-helpers'
chaiModule.use(chaiEthers)
const expect = chaiModule.expect
export { expect }
