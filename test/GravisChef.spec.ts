import { expect } from './chai-setup'
import hre, { getNamedAccounts, getUnnamedAccounts, ethers, } from 'hardhat'

import { BigNumber } from 'ethers'
import { Address } from 'hardhat-deploy/types'

import { TestERC20 } from '../typechain/TestERC20'
import { GravisChef } from '../typechain/GravisChef'
import { GravisTokenX } from '../typechain/GravisTokenX'
import { advanceBlock, advanceBlockTo, advanceBlockWith, latestBlockNumber } from '../src/time-utils'
import { tokenToBignumberWithDecimals } from '../src/utils'
import { SignerWithAddress } from 'hardhat-deploy-ethers/dist/src/signers'

const zeroAmount = BigNumber.from(0)
const oneAmount = BigNumber.from(1)
const twoAmount = BigNumber.from(2)
const perBlock = tokenToBignumberWithDecimals(30)
const oneToken = tokenToBignumberWithDecimals(1)
const twoTokens = tokenToBignumberWithDecimals(2)
const startBlock = BigNumber.from(1300)
const feeStage = [BigNumber.from(2500), BigNumber.from(1000), BigNumber.from(500), BigNumber.from(250), BigNumber.from(100)]
const feeStageDeltas = [0, 100, 200, 300, 400]
const MINTER_ROLE = ethers.utils.id('MINTER_ROLE')
const FEE_BASE = BigNumber.from(10000)
const LOCK_BLOCK = BigNumber.from(10)

const applyFee = (_fee: BigNumber, _amount: BigNumber) => {
  return _amount.mul(FEE_BASE.sub(_fee)).div(FEE_BASE)
}

const calculateFee = (_fee: BigNumber, _amount: BigNumber) => {
  return _amount.mul(_fee).div(FEE_BASE)
}

context('GravisChef', () => {
  let deployer: Address
  let feeRecipient: Address
  let wallet1: Address
  let wallet2: Address
  let wallet3: Address
  let wallet4: Address
  let lockTester: SignerWithAddress

  let chef: GravisChef
  let token: GravisTokenX
  let lp1: TestERC20
  let lp2: TestERC20
  let lp3: TestERC20
  let lp4: TestERC20

  before(async () => {
    deployer = (await getNamedAccounts()).deployer
    const accounts = await getUnnamedAccounts()

    feeRecipient = accounts[0]
    wallet1 = accounts[1]
    wallet2 = accounts[2]
    wallet3 = accounts[3]
    wallet4 = accounts[4]
    lockTester = await ethers.getSigner(accounts[5])
    hre.tracer.nameTags[ethers.constants.AddressZero] = 'Zero'
    hre.tracer.nameTags[deployer] = 'Deployer'
    hre.tracer.nameTags[feeRecipient] = 'FeeRecipient'
    hre.tracer.nameTags[wallet1] = 'Wallet1'
    hre.tracer.nameTags[wallet2] = 'Wallet2'
    hre.tracer.nameTags[wallet3] = 'Wallet3'
    hre.tracer.nameTags[wallet4] = 'Wallet4'
    hre.tracer.nameTags[lockTester.address] = 'LockTester'
  })

  beforeEach(async () => {
    const TokenContract = await ethers.getContractFactory('GravisTokenX')
    token = (await TokenContract.deploy()) as GravisTokenX

    const LpTokenContract = await ethers.getContractFactory('TestERC20')
    lp1 = (await LpTokenContract.deploy('LP1', 'LP1', 0)) as TestERC20
    lp2 = (await LpTokenContract.deploy('LP2', 'LP2', 0)) as TestERC20
    lp3 = (await LpTokenContract.deploy('LP3', 'LP3', 0)) as TestERC20
    lp4 = (await LpTokenContract.deploy('LP4', 'LP4', 0)) as TestERC20

    const ChefContract = await ethers.getContractFactory('GravisChef')
    chef = (await ChefContract.deploy(token.address, perBlock, startBlock, feeRecipient, feeStage, feeStageDeltas)) as GravisChef

    hre.tracer.nameTags[token.address] = 'GRVX'
    hre.tracer.nameTags[chef.address] = 'ChefContract'
    hre.tracer.nameTags[lp1.address] = 'LP1'
    hre.tracer.nameTags[lp2.address] = 'LP2'
    hre.tracer.nameTags[lp3.address] = 'LP3'
    hre.tracer.nameTags[lp4.address] = 'LP4'

    await token.mint(deployer, ethers.utils.parseUnits('100000'))
    await token.approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))

    await lp1.setBalance(deployer, ethers.utils.parseUnits('100000'))
    await lp1.approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))

    await lp1.setBalance(lockTester.address, ethers.utils.parseUnits('100000'))
    await lp1.connect(lockTester).approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))

    await lp1.setBalance(wallet1, ethers.utils.parseUnits('100000'))
    await lp2.setBalance(wallet2, ethers.utils.parseUnits('100000'))
    await lp3.setBalance(wallet3, ethers.utils.parseUnits('100000'))
    await lp4.setBalance(wallet4, ethers.utils.parseUnits('100000'))

    await lp1.connect(await ethers.getSigner(wallet1)).approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))
    await lp2.connect(await ethers.getSigner(wallet2)).approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))
    await lp3.connect(await ethers.getSigner(wallet3)).approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))
    await lp4.connect(await ethers.getSigner(wallet4)).approve(chef.address, BigNumber.from(2).pow(BigNumber.from(255)))

    await token.grantRole(MINTER_ROLE, chef.address)
  })

  describe('#contructor()', async () => {
    it('should set up pool and token', async () => {
      expect(await chef.gravisToken()).to.be.equal(token.address)
      expect(await chef.feeRecipient()).to.be.equal(feeRecipient)
      expect(await chef.tokenPerBlock()).to.be.equal(perBlock)
      expect(await chef.startBlock()).to.be.equal(startBlock)
      expect(await chef.getPoolLength()).to.be.equal(1)
      expect(await chef.totalAllocPoint()).to.be.equal(1000)
    })
  })

  describe('#add() set() setLock() del()', async () => {
    it('admin can add pool with update', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
    })

    it('admin can add pool w/o update', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, false)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
    })

    it('admin can update pool with update', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.set(1, 2, true)).to.emit(chef, 'PoolUpdate').withArgs(1, 2)
    })

    it('admin can update pool w/o update', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, false)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.set(1, 2, false)).to.emit(chef, 'PoolUpdate').withArgs(1, 2)
    })

    it('admin can set lock with update', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.setLock(1, LOCK_BLOCK, true)).to.emit(chef, 'PoolLockUpdate').withArgs(1, LOCK_BLOCK)
    })

    it('admin can set lock w/o update', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.setLock(1, LOCK_BLOCK, false)).to.emit(chef, 'PoolLockUpdate').withArgs(1, LOCK_BLOCK)
    })

    it('admin can delete pool with update', async () => {
      await expect(chef.add(0, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 0)
      await expect(chef.del(1, true)).to.emit(chef, 'PoolRemoved').withArgs(1)
    })

    it('admin can delete pool w/o update', async () => {
      await expect(chef.add(0, lp1.address, zeroAmount, false)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 0)
      await expect(chef.del(1, false)).to.emit(chef, 'PoolRemoved').withArgs(1)
    })

    it('admin can not add existing pool', async () => {
      await chef.add(1, lp1.address, zeroAmount, true)
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.be.revertedWith('GravisChef: Pool already exists')
    })

    it('admin can not delete non-existing pool', async () => {
      await expect(chef.del(1, false)).to.be.revertedWith('GravisChef: Pool not exists')
    })

    it('admin can not delete staking pool', async () => {
      await expect(chef.del(0, false)).to.be.revertedWith('GravisChef: Staking pool')
    })

    it('admin can not delete active pool', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.del(1, false)).to.be.revertedWith('GravisChef: Pool is active')
    })

    it('admin can not delete non-empty pool', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, true)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.deposit(1, oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, 1, oneAmount)
      await expect(chef.set(1, 0, true)).to.emit(chef, 'PoolUpdate').withArgs(1, 0)
      await expect(chef.del(1, false)).to.be.revertedWith('GravisChef: Pool not empty')
    })

    it('non-admin can not add or update pool', async () => {
      await expect(chef.connect(await ethers.getSigner(wallet1)).add(1, lp1.address, zeroAmount, true)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
      await expect(chef.connect(await ethers.getSigner(wallet1)).set(1, 2, true)).to.be.revertedWith('Ownable: caller is not the owner')
      await expect(chef.connect(await ethers.getSigner(wallet1)).setLock(1, LOCK_BLOCK, true)).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('non-admin can not delete pool', async () => {
      await expect(chef.add(1, lp1.address, zeroAmount, false)).to.emit(chef, 'PoolAdd').withArgs(lp1.address, 1)
      await expect(chef.connect(await ethers.getSigner(wallet1)).del(1, true)).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('#setMultiplier()', async () => {
    it('admin can update multiplier', async () => {
      await chef.setMultiplier(2)
      expect(await chef.bonusMultiplier()).to.be.equal(2)
    })

    it('admin can not set zero multiplier', async () => {
      await expect(chef.setMultiplier(0)).to.be.revertedWith('GravisChef: Zero multiplier')
    })

    it('non-admin can not update multiplier', async () => {
      await expect(chef.connect(await ethers.getSigner(wallet1)).setMultiplier(2)).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('#setFeeRecipient()', async () => {
    it('admin can update fee recipient', async () => {
      await chef.setFeeRecipient(wallet1)
      expect(await chef.feeRecipient()).to.be.equal(wallet1)
    })

    it('admin can not set zero fee recipient', async () => {
      await expect(chef.setFeeRecipient(ethers.constants.AddressZero)).to.be.revertedWith('GravisChef: Zero fee recipient')
    })

    it('non-admin can not update fee recipient', async () => {
      await expect(chef.connect(await ethers.getSigner(wallet1)).setFeeRecipient(wallet1)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#setTokenPerBlock()', async () => {
    it('admin can update token per block', async () => {
      await chef.setTokenPerBlock(oneToken)
      expect(await chef.tokenPerBlock()).to.be.equal(oneToken)
    })

    // it('token per block check max min', async () => {
    //   await expect(chef.setTokenPerBlock(ethers.utils.parseUnits('100'))).to.be.revertedWith('GravisChef: Max per block 30 tokens')
    //   await expect(chef.setTokenPerBlock(oneAmount)).to.be.revertedWith('GravisChef: Min per block 1 token')
    // })

    it('non-admin can not update token per block', async () => {
      await expect(chef.connect(await ethers.getSigner(wallet1)).setTokenPerBlock(oneToken)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#setFeeStage()', async () => {
    it('admin can update fee stage', async () => {
      await chef.setFeeStage(feeStage)
    })

    it('admin can not set incorrect fee stage', async () => {
      await expect(chef.setFeeStage([...feeStage, ...feeStage])).to.be.revertedWith('GravisChef: FeeStage array mismatch')
    })

    it('non-admin can not update fee recipient', async () => {
      await expect(chef.connect(await ethers.getSigner(wallet1)).setFeeStage(feeStage)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#setBlockDeltaFeeStage()', async () => {
    it('admin can update fee stage', async () => {
      await chef.setBlockDeltaFeeStage(feeStageDeltas)
    })

    it('admin can not set incorrect fee stage', async () => {
      await expect(chef.setBlockDeltaFeeStage([...feeStageDeltas, ...feeStageDeltas])).to.be.revertedWith(
        'GravisChef: BlockDeltaFeeStage array mismatch'
      )
    })

    it('non-admin can not update fee recipient', async () => {
      await expect(chef.connect(await ethers.getSigner(wallet1)).setBlockDeltaFeeStage(feeStageDeltas)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#deposit()', async () => {
    const poolId = 1
    beforeEach('create pool', async () => {
      await chef.add(1, lp1.address, zeroAmount, true)
    })
    it('User can deposit lp to the pool', async () => {
      await expect(chef.deposit(poolId, oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, oneAmount)
    })
    it('User can deposit lp to the pool more then once', async () => {
      await expect(chef.deposit(poolId, oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, oneAmount)
      await expect(chef.deposit(poolId, oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, oneAmount)
    })
    it('User can deposit zero lp to the pool', async () => {
      await expect(chef.deposit(poolId, zeroAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, zeroAmount)
    })
    it('User can not deposit lp to the staking pool', async () => {
      await expect(chef.deposit(0, oneAmount)).to.be.revertedWith('GravisChef: Deposit to the staking pool')
    })
  })

  describe('#withdraw() w/o lock', async () => {
    const poolId = 1
    beforeEach('create pool and deposit', async () => {
      await chef.add(1, lp1.address, zeroAmount, true)
      await chef.deposit(poolId, oneAmount)
    })
    it('User can withdraw lp from the pool', async () => {
      await expect(chef.withdraw(poolId, oneAmount)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneAmount)
    })
    it('User can withdraw zero lp from the pool', async () => {
      await expect(chef.withdraw(poolId, zeroAmount)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, zeroAmount)
    })
    it('User can not withdraw lp from the staking pool', async () => {
      await expect(chef.withdraw(0, oneAmount)).to.be.revertedWith('GravisChef: Withdraw from the staking pool')
    })
    it('User can not withdraw exceed amount', async () => {
      await expect(chef.withdraw(poolId, twoAmount)).to.be.revertedWith('GravisChef: Withdraw amount exceeds user amount')
    })
  })

  describe('#withdraw() with lock', async () => {
    const poolId = 1
    let startLockBlock = 0;
    beforeEach('create pool and deposit', async () => {
      await chef.add(1, lp1.address, LOCK_BLOCK, true)
      startLockBlock = await latestBlockNumber()
      await chef.connect(lockTester).deposit(poolId, oneAmount)
    })
    it('Should correctly set lock block for the user deposit', async () => {
      const userInfo = await chef.userInfo(poolId, lockTester.address)
      expect(userInfo.unlockBlock).to.be.equal(LOCK_BLOCK.add(startLockBlock+1))
    })
    it('User can not withdraw lp from the pool before lock block', async () => {
      await expect(chef.connect(lockTester).withdraw(poolId, oneAmount)).to.be.revertedWith('GravisChef: Withdraw locked')
    })
    it('User can withdraw lp from the pool after lock block', async () => {
      await advanceBlockWith(LOCK_BLOCK.toNumber())
      await expect(chef.connect(lockTester).withdraw(poolId, oneAmount)).to.emit(chef, 'Withdraw').withArgs(lockTester.address, poolId, oneAmount)
    })
    it('User can full withdraw after initial deposit unlocks', async () => {
      await chef.connect(lockTester).deposit(poolId, oneAmount)
      
      await expect(chef.connect(lockTester).withdraw(poolId, twoAmount)).to.be.revertedWith('GravisChef: Withdraw locked')
      
      const userInfo = await chef.userInfo(poolId, lockTester.address)
      expect(userInfo.unlockBlock).to.be.equal(LOCK_BLOCK.add(startLockBlock+1))

      await advanceBlockWith(LOCK_BLOCK.toNumber())

      await expect(chef.connect(lockTester).withdraw(poolId, twoAmount)).to.emit(chef, 'Withdraw').withArgs(lockTester.address, poolId, twoAmount)
    })
  })

  describe('#stake()', async () => {
    const poolId = 0
    it('User can deposit GRVX to the staking pool', async () => {
      await expect(chef.stake(oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, oneAmount)
    })
    it('User can deposit GRVX to the staking pool more then once', async () => {
      await expect(chef.stake(oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, oneAmount)
      await expect(chef.stake(oneAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, oneAmount)
    })
    it('User can deposit zero GRVX to the staking pool', async () => {
      await expect(chef.stake(zeroAmount)).to.emit(chef, 'Deposit').withArgs(deployer, poolId, zeroAmount)
    })
  })

  describe('#unstake()', async () => {
    const poolId = 0
    beforeEach('create deposit', async () => {
      await chef.stake(oneAmount)
    })
    it('User can withdraw GRVX from the staking pool', async () => {
      await expect(chef.unstake(oneAmount)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneAmount)
    })
    it('User can withdraw zero GRVX from the staking pool', async () => {
      await expect(chef.unstake(zeroAmount)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, zeroAmount)
    })
    it('User can not withdraw exceed amount', async () => {
      await expect(chef.unstake(twoAmount)).to.be.revertedWith('GravisChef: Unstake amount exceeds user amount')
    })
  })

  describe('#emergencyWithdraw()', async () => {
    const poolId = 1
    beforeEach('create pool and deposit', async () => {
      await chef.stake(oneToken)
      await chef.add(1, lp1.address, zeroAmount, true)
      await chef.deposit(poolId, twoTokens)
    })
    it('User can emergency withdraw GRVX from the pool with 25% fee', async () => {
      const feeAmount = calculateFee(feeStage[0], oneToken)
      const withdrawAmount = applyFee(feeStage[0], oneToken)
      await expect(chef.emergencyWithdraw(0)).to.emit(chef, 'EmergencyWithdraw').withArgs(deployer, 0, withdrawAmount)
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeAmount)
    })
    it('User can emergency withdraw LP from the pool with 25% fee', async () => {
      const feeAmount = calculateFee(feeStage[0], twoTokens)
      const withdrawAmount = applyFee(feeStage[0], twoTokens)
      await expect(chef.emergencyWithdraw(poolId)).to.emit(chef, 'EmergencyWithdraw').withArgs(deployer, poolId, withdrawAmount)
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeAmount)
    })
  })

  describe('#getPendingRewards()', async () => {
    const poolId = 1
    beforeEach('create pool and deposit', async () => {
      await chef.stake(oneToken)
      await chef.add(1000, lp1.address, zeroAmount, true)
      await chef.deposit(poolId, oneToken)
    })
    it('Pending rewards per block', async () => {
      expect(await chef.getPendingRewards(0, deployer)).to.be.equal(0)

      //advance one block after start, reward should be perBlock / 2,
      // as we have 2 pools with same allocation points
      await advanceBlockTo(startBlock.add(1).toNumber())

      expect(await chef.getPendingRewards(0, deployer)).to.be.equal(BigNumber.from(perBlock).div(2))
      expect(await chef.getPendingRewards(1, deployer)).to.be.equal(BigNumber.from(perBlock).div(2))

      //advance another block, reward should be perBlock,
      // as we have 2 pools with same allocation points
      await advanceBlock()
      expect(await chef.getPendingRewards(0, deployer)).to.be.equal(BigNumber.from(perBlock))
      expect(await chef.getPendingRewards(1, deployer)).to.be.equal(BigNumber.from(perBlock))
    })
  })

  describe('#getWithdrawalFee()', async () => {
    const poolId = 1
    let depositBlock = startBlock
    let feeBalanceLp = BigNumber.from(0)
    let feeBalanceToken = BigNumber.from(0)
    beforeEach('create pool and deposit', async () => {
      await chef.stake(oneToken)
      await chef.add(1000, lp1.address, zeroAmount, true)
      await chef.deposit(poolId, oneToken)
      depositBlock = BigNumber.from(await latestBlockNumber())
      feeBalanceLp = await lp1.balanceOf(feeRecipient)
      feeBalanceToken = await token.balanceOf(feeRecipient)
    })
    it('Withdrawal period [1]', async () => {
      await advanceBlockTo(depositBlock.add(feeStageDeltas[1]).sub(4).toNumber())

      const feeAmount = calculateFee(feeStage[1], oneToken)
      await expect(chef.withdraw(poolId, oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneToken)
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeBalanceLp.add(feeAmount))

      await expect(chef.unstake(oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, 0, oneToken)
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeBalanceToken.add(feeAmount))
    })

    it('Withdrawal period [2]', async () => {
      await advanceBlockTo(depositBlock.add(feeStageDeltas[2]).sub(4).toNumber())

      const feeAmount = calculateFee(feeStage[2], oneToken)
      await expect(chef.withdraw(poolId, oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneToken)
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeBalanceLp.add(feeAmount))

      await expect(chef.unstake(oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, 0, oneToken)
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeBalanceToken.add(feeAmount))
    })

    it('Withdrawal period [3]', async () => {
      await advanceBlockTo(depositBlock.add(feeStageDeltas[3]).sub(4).toNumber())

      const feeAmount = calculateFee(feeStage[3], oneToken)
      await expect(chef.withdraw(poolId, oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneToken)
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeBalanceLp.add(feeAmount))

      await expect(chef.unstake(oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, 0, oneToken)
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeBalanceToken.add(feeAmount))
    })
    it('Withdrawal period [4]', async () => {
      await advanceBlockTo(depositBlock.add(feeStageDeltas[4]).sub(4).toNumber())

      const feeAmount = calculateFee(feeStage[4], oneToken)
      await expect(chef.withdraw(poolId, oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneToken)
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeBalanceLp.add(feeAmount))

      await expect(chef.unstake(oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, 0, oneToken)
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeBalanceToken.add(feeAmount))
    })

    it('Withdrawal period [5]: zero fee', async () => {
      await advanceBlockTo(depositBlock.add(feeStageDeltas[4]).add(4).toNumber())

      await expect(chef.withdraw(poolId, oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, poolId, oneToken)
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(0)

      await expect(chef.unstake(oneToken)).to.emit(chef, 'Withdraw').withArgs(deployer, 0, oneToken)
      expect(await token.balanceOf(feeRecipient)).to.be.equal(0)
    })

    it('Double withdrawal [1,4]: check last withdraw block', async () => {
      let withdrawBlock = depositBlock.add(feeStageDeltas[1]).sub(4).toNumber()
      await advanceBlockTo(withdrawBlock)

      const feeAmount = calculateFee(feeStage[1], oneToken.div(2))
      await expect(chef.withdraw(poolId, oneToken.div(2)))
        .to.emit(chef, 'Withdraw')
        .withArgs(deployer, poolId, oneToken.div(2))
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeBalanceLp.add(feeAmount))

      await expect(chef.unstake(oneToken.div(2)))
        .to.emit(chef, 'Withdraw')
        .withArgs(deployer, 0, oneToken.div(2))
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeBalanceToken.add(feeAmount))

      withdrawBlock = BigNumber.from(withdrawBlock).add(feeStageDeltas[4]).add(4).toNumber()
      await advanceBlockTo(withdrawBlock)

      await expect(chef.withdraw(poolId, oneToken.div(2)))
        .to.emit(chef, 'Withdraw')
        .withArgs(deployer, poolId, oneToken.div(2))
      expect(await lp1.balanceOf(feeRecipient)).to.be.equal(feeBalanceLp.add(feeAmount))

      await expect(chef.unstake(oneToken.div(2)))
        .to.emit(chef, 'Withdraw')
        .withArgs(deployer, 0, oneToken.div(2))
      expect(await token.balanceOf(feeRecipient)).to.be.equal(feeBalanceToken.add(feeAmount))
    })
  })

  describe('#claimRewards() && claimReward()', async () => {
    const poolId = 1
    let depositBlock = startBlock
    let claimBalance = BigNumber.from(0)
    // before('advance to startBlock', async () => {
    //   await advanceBlockTo(depositBlock.toNumber())
    // })
    beforeEach('create pool and deposit', async () => {
      await chef.add(1000, lp1.address, zeroAmount, true)
      await chef.stake(oneToken)
      await chef.deposit(poolId, oneToken)
      depositBlock = BigNumber.from(await latestBlockNumber())
      claimBalance = await token.balanceOf(deployer)
    })
    it('farm for one block and claim from stake and pool', async () => {
      await chef.claimRewards([0, poolId])

      // 1 block full per block amount for the staking pool
      // 1 block half per block amount for the lp pool
      const expectedFarm = perBlock.add(perBlock.div(2))

      expect(await token.balanceOf(deployer)).to.be.equal(claimBalance.add(expectedFarm))
    })

    it('farm for two blocks and claim from stake and pool', async () => {
      await advanceBlockTo(depositBlock.add(1).toNumber())

      await chef.claimRewards([0, poolId])

      // 1 block full per block amount for the staking pool
      // 1 block half per block amount for the staking pool
      // 2 block half per block amount for the lp pool
      const expectedFarm = perBlock.add(perBlock.div(2)).add(perBlock)

      expect(await token.balanceOf(deployer)).to.be.equal(claimBalance.add(expectedFarm))
    })

    it('second deposit next block, check autoclaimed amount', async () => {
      await advanceBlockTo(depositBlock.add(1).toNumber())

      await chef.stake(oneToken)
      // 1 block full per block amount for the staking pool
      // 1 block half per block amount for the staking pool
      // minus oneToken
      let expectedFarm = perBlock.add(perBlock.div(2)).sub(oneToken)
      expect(await token.balanceOf(deployer)).to.be.equal(claimBalance.add(expectedFarm))

      await chef.deposit(poolId, oneToken)
      // 1 block full per block amount for the staking pool
      // 1 block half per block amount for the staking pool
      // no need to minus oneToken, as we're depositing lp token
      expectedFarm = expectedFarm.add(perBlock.add(perBlock.div(2)))
      expect(await token.balanceOf(deployer)).to.be.equal(claimBalance.add(expectedFarm))
    })
  })
})
