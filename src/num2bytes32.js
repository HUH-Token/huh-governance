import { BigNumber } from 'ethers'

const numStringToBytes32 = (num) => {
  const bn = BigNumber.from(num).toTwos(256)
  return padToBytes32(bn.toHexString(16).slice(2))
}

const bytes32ToNumString = (bytes32str) => {
  bytes32str = bytes32str.replace(/^0x/, '')
  const bn = new BigNumber(bytes32str, 16).fromTwos(256)
  return bn.toString()
}

const padToBytes32 = (n) => {
  while (n.length < 64) {
    n = '0' + n
  }
  return '0x' + n
}

export { numStringToBytes32, bytes32ToNumString }
