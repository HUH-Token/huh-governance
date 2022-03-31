import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from './signers'
import { gnosisSafe, multisig } from './multisig'
import { getImplementation } from './getImplementation'
import { upgrades } from 'hardhat'
import { getContractArgs } from './getContractArgs'

const upgrade = async (deployArtifacts) => {
  const { deploy } = deployments
  const { proxy01Owner, deployer } = await getNamedSigners()
  const HUHGovernanceV2Contract = await ethers.getContractFactory('HUHGovernance_V2', deployer)
  const constructorArgs = getContractArgs(deployArtifacts)
  const previousImplementation = await getImplementation(deployArtifacts.hUHGovernance)
  // console.log(`Previous implementation: ${previousImplementation}`)
  const huhGovernanceV1 = await ethers.getContractAt('HUHGovernance', previousImplementation)
  if (multisig) {
    // multisig deploy
    console.log('Registering proxy for upgrade...')
    const HUHGovernanceContract = await ethers.getContractFactory('HUHGovernance')
    const proxy = await upgrades.forceImport(deployArtifacts.hUHGovernance.address, HUHGovernanceContract, { multisig: gnosisSafe, constructorArgs })
    console.log('Proxy registered at:', proxy.address)
    console.log('Preparing proposal...')
    // const proposal = await defender.proposeUpgrade(deployArtifacts.hUHGovernance.address, HUHGovernanceV2Contract, { multisig: gnosisSafe, constructorArgs })
    const proposal = await defender.proposeUpgrade(proxy.address, HUHGovernanceV2Contract, { multisig: gnosisSafe, constructorArgs })
    console.log('Upgrade proposal created at:', proposal.url)
  } else {
    await deploy('HUHGovernance', {
      contract: 'HUHGovernance_V2',
      from: deployer.address,
      args: constructorArgs,
      proxy: {
        owner: proxy01Owner.address,
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
    await huhGovernanceV1.connect(deployer).transferOwnership(newImplementation)
    const hUHGovernanceV2 = HUHGovernanceV2Contract.attach(newImplementation)
    await hUHGovernanceV2.connect(proxy01Owner).onUpgrade(previousImplementation)
  }
}

export { upgrade }
