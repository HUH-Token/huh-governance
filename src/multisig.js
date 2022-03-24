const gnosisSafe = '0x9f01873CE9eD346b2ae76eb36dD98ff0198DF9aA'

let multisig
switch (hre.network.name) {
  case 'hardhat':
    multisig = false
    break
  case 'rinkeby':
  default:
    multisig = true
    break
}

export { gnosisSafe, multisig }
