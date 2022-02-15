import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Constants } from '../src/constants'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  //const tokenInstance = await deployments.get('GravisToken')

  const { Master } = Constants
  await deploy('GravisMaster', {
    from: deployer,
    args: [Master.token, Master.provider, Master.nfts],
    log: true,
  })
}
export default func
func.tags = ['Master']
