module.exports = {
  ignorePatterns: ['coverage/'],
  env: {
    es2021: true,
    mocha: true
  },
  extends: [
    'standard'
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  rules: {
  },
  globals: {
    defender: true,
    hre: true,
    ethers: true,
    deployments: true,
    getNamedAccounts: true,
    waffle: true,
    getUnnamedAccounts: true
  }
}
