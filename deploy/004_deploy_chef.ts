import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { Constants } from '../src/constants'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const tokenInstance = await deployments.get('GravisTokenX')

  const { Chef } = Constants
  // GravisToken _token,
  // uint256 _perBlock,
  // uint256 _startBlock,
  // address _feeRecipient,
  // uint256[] memory _feeStage,
  // uint256[] memory _blockDeltaFeeStage
  await deploy('GravisChef', {
    from: deployer,
    args: [tokenInstance.address, Chef.perBlock, Chef.startBlock, Chef.feeRecipient, Chef.feeStage, Chef.feeStageDeltas],
    log: true,
  })
}
export default func
func.tags = ['Chef']
