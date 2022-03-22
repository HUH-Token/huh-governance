import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from './signers'
import { getImplementation } from './getImplementation'
import { defender } from 'hardhat'

const upgrade = async (deployArtifacts, accountDeploy) => {
  const HUHGovernanceV2Contract = await ethers.getContractFactory('HUHGovernance_V2')
  if (accountDeploy) {
    const { deploy } = deployments
    const { proxy01Owner, deployer } = await getNamedSigners()

    const previousImplementation = await getImplementation(deployArtifacts.hUHGovernance)
    // console.log(`Previous implementation: ${previousImplementation}`)

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
    // console.log(`New implementation: ${newImplementation}`)
    const huhGovernanceV1 = await ethers.getContractAt('HUHGovernance', previousImplementation)
    await huhGovernanceV1.connect(deployer).transferOwnership(newImplementation)
    const hUHGovernanceV2 = HUHGovernanceV2Contract.attach(newImplementation)
    await hUHGovernanceV2.connect(deployer).onUpgrade(previousImplementation)
  } else {
    // multisig deploy
    console.log('Preparing proposal...')
    const proposal = await defender.proposeUpgrade(deployArtifacts.hUHGovernance.address, HUHGovernanceV2Contract)
    console.log('Upgrade proposal created at:', proposal.url)
  }
}

export { upgrade }
