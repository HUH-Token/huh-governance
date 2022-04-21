import { /* setupUsers, connectAndGetNamedAccounts, */ getNamedSigners } from './signers'
import { gnosisSafe, multisig } from './multisig'
import { getImplementation } from './getImplementation'
import { upgrades } from 'hardhat'
import { getContractArgs } from './getContractArgs'
import { verify } from './verify'

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const upgrade = async (deployArtifacts) => {
  const { deploy, save } = deployments
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

    const artifact = await deployments.getExtendedArtifact('HUHGovernance_V2')
    const proxyDeployments = {
      address: proposal.metadata.newImplementationAddress,
      ...artifact
    }

    await save('HUHGovernance_V2', proxyDeployments)

    // Either wait a minute or 5 block confirmations to start the verification process.
    // In the meanwhile the improvement of https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/554 is not implemented, we will use a one minute workaround
    console.log('Awaiting one minute to start verifying the proposal...')
    await sleep(60000)
    await verify(hre.network.name, proposal.metadata.newImplementationAddress, constructorArgs)
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
