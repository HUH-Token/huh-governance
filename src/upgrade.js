import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from './signers'
import { getImplementation } from './getImplementation'

const upgrade = async (deployArtifacts) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()

  const previousImplementation = await getImplementation(deployArtifacts.hUHGovernance)
  //   console.log(`Previous implementation: ${previousImplementation}`)

  await deploy('HUHGovernance', {
    contract: 'HUHGovernance_V2',
    from: proxy01Owner.address,
    args: [
      deployArtifacts.acceptedToken.address,
      deployArtifacts.timestamp.address,
      50 // Maximum lock time in years
    ],
    proxy: {
      proxyContract: 'ERC1967Proxy',
      proxyArgs: ['{implementation}', '{data}']
      // execute: {
      //   onUpgrade: {
      //     methodName: 'onUpgrade',
      //     args: [
      //       previousImplementation
      //     ]
      //   }
      // }
    },
    log: true
  })

  const newImplementation = await getImplementation(deployArtifacts.hUHGovernance)
  //   console.log(`New implementation: ${newImplementation}`)
  const huhGovernanceV1 = await ethers.getContractAt('HUHGovernance', previousImplementation)
  await huhGovernanceV1.connect(deployer).transferOwnership(newImplementation)
  const HUHGovernanceV2Contract = await ethers.getContractFactory('contracts/HUHGovernance_V2.sol:HUHGovernance_V2')
  const hUHGovernanceV2 = HUHGovernanceV2Contract.attach(newImplementation)
  await hUHGovernanceV2.connect(deployer).onUpgrade(previousImplementation)
}

export { upgrade }
