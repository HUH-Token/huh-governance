const getContractArgs = (deployArtifacts) => {
  const args = [
    deployArtifacts.acceptedToken.address,
    deployArtifacts.timestamp.address,
    50 // Maximum lock time in years
  ]
  return args
}

export { getContractArgs }
