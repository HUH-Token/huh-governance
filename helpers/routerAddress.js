const getRouterAddress = (network) => {
  switch (network) {
    case 'mainnet':
    case 'rinkeby':
    case 'ropsten':
    case 'goerli':
    case 'kovan':
      return '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
    case 'bscmainnet':
      return '0x10ED43C718714eb63d5aA57B78B54704E256024E'
  }
}

export { getRouterAddress }
