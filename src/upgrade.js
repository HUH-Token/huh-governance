import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from './signers'
import { gnosisSafe, multisig } from './multisig'
import {
  getImplementationAddress
} from '@openzeppelin/upgrades-core'

const upgrade = async (deployArtifacts) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()
  const HUHGovernanceV2Contract = await ethers.getContractFactory('HUHGovernance_V2')
  const previousImplementation = await getImplementationAddress(hre.network.provider, deployArtifacts.hUHGovernance.address)
  // console.log(`Previous implementation: ${previousImplementation}`)
  const huhGovernanceV1 = await ethers.getContractAt('HUHGovernance', previousImplementation)
  const constructorArgs = [
    deployArtifacts.acceptedToken.address,
    deployArtifacts.timestamp.address,
    50 // Maximum lock time in years
  ]
  if (multisig) {
    // multisig deploy
    console.log('Preparing proposal...')
    const proposal = await defender.proposeUpgrade(deployArtifacts.hUHGovernance.address, HUHGovernanceV2Contract, { multisig: gnosisSafe, constructorArgs })
    console.log('Upgrade proposal created at:', proposal.url)
  } else {
    await deploy('HUHGovernance', {
      contract: 'HUHGovernance_V2',
      from: proxy01Owner.address,
      args: constructorArgs,
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

    const newImplementation = await getImplementationAddress(hre.network.provider, deployArtifacts.hUHGovernance.address)
    // console.log(`New implementation: ${newImplementation}`)
    await huhGovernanceV1.connect(deployer).transferOwnership(newImplementation)
    const hUHGovernanceV2 = HUHGovernanceV2Contract.attach(newImplementation)
    await hUHGovernanceV2.connect(deployer).onUpgrade(previousImplementation)
  }
}

export { upgrade }
