import { expect } from './chai-setup'
import hre, { getNamedAccounts, getUnnamedAccounts, ethers } from 'hardhat'

import { BigNumber } from 'ethers'
import { Address } from 'hardhat-deploy/types'

import { TestERC20 } from '../typechain/TestERC20'
import { GravisMaster } from '../typechain/GravisMaster'
import { GravisCollectible } from '../typechain/GravisCollectible'
import { advanceTime, duration, increase, latest } from '../src/time-utils'
import { tokenToWei } from '../src/utils'

const zeroAmount = BigNumber.from(0)
const oneAmount = BigNumber.from(1)
const twoAmount = BigNumber.from(2)
const nominalPrice = BigNumber.from(100)
const maxSupply = BigNumber.from(100)

context('GravisMaster', () => {
  let deployer: Address
  let tokenProvider: Address
  let wallet1: Address
  let wallet2: Address
  let wallet3: Address
  let wallet4: Address

  let master: GravisMaster
  let collection: GravisCollectible
  let token: TestERC20

  before(async () => {
    deployer = (await getNamedAccounts()).deployer
    const accounts = await getUnnamedAccounts()

    tokenProvider = accounts[0]
    wallet1 = accounts[1]
    wallet2 = accounts[2]
    wallet3 = accounts[3]
    wallet4 = accounts[4]
    hre.tracer.nameTags[ethers.constants.AddressZero] = 'Zero'
    hre.tracer.nameTags[deployer] = 'Deployer'
    hre.tracer.nameTags[tokenProvider] = 'TokenProvider'
    hre.tracer.nameTags[wallet1] = 'Wallet1'
    hre.tracer.nameTags[wallet2] = 'Wallet2'
    hre.tracer.nameTags[wallet3] = 'Wallet3'
    hre.tracer.nameTags[wallet4] = 'Wallet4'
  })

  beforeEach(async () => {
    const TokenContract = await ethers.getContractFactory('TestERC20')
    token = (await TokenContract.deploy('Gravis Token', 'GRV', 0)) as TestERC20

    const CollectionContract = await ethers.getContractFactory('GravisCollectible')
    collection = (await CollectionContract.deploy()) as GravisCollectible
    await collection.createNewTokenType(nominalPrice, maxSupply, 'type1', '1.json')
    await collection.createNewTokenType(nominalPrice, maxSupply, 'type2', '2.json')
    await collection.createNewTokenType(nominalPrice, maxSupply, 'type3', '3.json')

    const MasterContract = await ethers.getContractFactory('GravisMaster')
    master = (await MasterContract.deploy(token.address, tokenProvider, [collection.address])) as GravisMaster

    hre.tracer.nameTags[token.address] = 'GRV'
    hre.tracer.nameTags[collection.address] = 'CollectionContract'
    hre.tracer.nameTags[master.address] = 'MasterContract'

    await token.setBalance(tokenProvider, ethers.utils.parseUnits('100000'))

    await token.connect(await ethers.getSigner(tokenProvider)).approve(master.address, BigNumber.from(2).pow(BigNumber.from(255)))

    await collection.addMinter(deployer)
    await collection.mint(deployer, 0, 10)
    await collection.mint(deployer, 1, 10)
    await collection.mint(deployer, 2, 10)
    await collection.setApprovalForAll(master.address, true)

    await collection.mint(wallet1, 0, 10)
    await collection.mint(wallet1, 1, 10)
    await collection.mint(wallet1, 2, 10)
    await collection.connect(await ethers.getSigner(wallet1)).setApprovalForAll(master.address, true)
  })

  describe('#contructor()', async () => {
    it('should set up pools and tokens', async () => {
      expect(await master.token()).to.be.equal(token.address)
      expect(await master.tokenProvider()).to.be.equal(tokenProvider)
      expect(await master.claimAllowed()).to.be.equal(false)
    })
  })

  describe('#claimAllowed()', async () => {
    it('admin can allow claim', async () => {
      await master.allowClaim()
      expect(await master.claimAllowed()).to.be.equal(true)
    })

    it('non-admin can not allow claim', async () => {
      await expect(master.connect(await ethers.getSigner(wallet1)).allowClaim()).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Cannot claim claim is not allowed', async () => {
      await master.deposit(0, oneAmount)
      await increase(duration.days('10'))
      await expect(master.claimRewards(0)).to.be.revertedWith('GravisMaster: Claim not allowed')
    })
  })

  describe('#setBonusDeadlineTime()', async () => {
    it('admin can set bonus deadline time', async () => {
      await master.setBonusDeadlineTime()
      expect(await master.bonusDeadlineTime()).to.be.gt(0)
    })

    it('non-admin can set bonus deadline time', async () => {
      await expect(master.connect(await ethers.getSigner(wallet1)).setBonusDeadlineTime()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })
  })

  describe('#pause() unpause()', async () => {
    it('admin can pause when not paused', async () => {
      await expect(master.pause()).to.emit(master, 'Paused').withArgs(deployer)
      expect(await master.paused()).to.be.equal(true)
    })

    it('admin can not pause when already paused', async () => {
      await master.pause()
      await expect(master.pause()).to.be.revertedWith('Pausable: paused')
    })

    it('admin can unpause when paused', async () => {
      await master.pause()
      await expect(master.unpause()).to.emit(master, 'Unpaused').withArgs(deployer)
      expect(await master.paused()).to.be.equal(false)
    })

    it('admin can not unpause when already unpaused', async () => {
      await expect(master.unpause()).to.be.revertedWith('Pausable: not paused')
    })

    it('non-admin can not pause or unpause', async () => {
      await expect(master.connect(await ethers.getSigner(wallet1)).pause()).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('#deposit()', async () => {
    it('User can deposit NFT to the Evangelist Pool', async () => {
      await expect(master.deposit(0, oneAmount)).to.emit(master, 'Deposit').withArgs(deployer, 0, oneAmount)
      expect(await master.depositIds()).to.be.equal(1)
    })
    it('User can deposit NFT to the Advocate Pool', async () => {
      await expect(master.deposit(1, oneAmount)).to.emit(master, 'Deposit').withArgs(deployer, 1, oneAmount)
      expect(await master.depositIds()).to.be.equal(1)
    })
    it('User can deposit NFT to the Believer Pool', async () => {
      await expect(master.deposit(2, oneAmount)).to.emit(master, 'Deposit').withArgs(deployer, 2, oneAmount)
      expect(await master.depositIds()).to.be.equal(1)
    })

    it('User can deposit NFT to all pools', async () => {
      await expect(master.deposit(0, oneAmount)).to.emit(master, 'Deposit').withArgs(deployer, 0, oneAmount)
      await expect(master.deposit(1, oneAmount)).to.emit(master, 'Deposit').withArgs(deployer, 1, oneAmount)
      await expect(master.deposit(2, oneAmount)).to.emit(master, 'Deposit').withArgs(deployer, 2, oneAmount)
      expect(await master.depositIds()).to.be.equal(3)
    })
    it('User cannot deposit with zero amount', async () => {
      await expect(master.deposit(0, zeroAmount)).to.be.revertedWith('GravisMaster: Zero amount')
    })
    it('User cannot deposit to non-existing pool', async () => {
      await expect(master.deposit(3, zeroAmount)).to.be.revertedWith('GravisMaster: Invalid Pool Id')
    })
  })

  describe('claimRewards()', async () => {
    const poolId = 0
    beforeEach('create deposit', async () => {
      await master.allowClaim()
    })
    it('Cannot claim if no deposits', async () => {
      await expect(master.claimRewards(poolId)).to.be.revertedWith('GravisMaster: No deposits')
    })

    it('Cannot claim if zero rewards', async () => {
      await master.deposit(poolId, oneAmount)
      await increase(duration.days('100'))
      await master.claimRewards(poolId)
      await expect(master.claimRewards(poolId)).to.be.revertedWith('GravisMaster: Zero rewards')
    })
    it('Cannot claim if no tokens at token provider', async () => {
      await master.deposit(poolId, oneAmount)
      await increase(duration.days('10'))
      await token.setBalance(tokenProvider, ethers.utils.parseUnits('0'))
      await expect(master.claimRewards(poolId)).to.be.revertedWith('GravisMaster: Not enough tokens')
    })
    it('Cannot claim from the different pool', async () => {
      await master.deposit(poolId, oneAmount)
      await increase(duration.days('10'))
      await expect(master.claimRewards(1)).to.be.revertedWith('GravisMaster: Zero rewards')
    })
  })

  describe('Believer Pool: claimRewards()', async () => {
    const poolId = 2
    beforeEach('create deposit', async () => {
      await master.allowClaim()
      await master.deposit(poolId, oneAmount)
    })

    it('Claim after 10 days', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed

      const amount = pool.nominalSpeed.mul(duration.days('10')).add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)
    })

    it('Claim after 10 days, wait 10 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed
      const amount10d = pool.nominalSpeed.mul(duration.days('10'))

      let amount = amount10d.add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount10d)
    })
    it('2 claims after 10 days, wait 10 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed
      const amount10d = pool.nominalSpeed.mul(duration.days('10'))

      let amount = amount10d.add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))

      amount = amount.add(amount10d)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount10d)
    })

    it('Claim after 25 days, wait 25 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('25'))

      // 5 days on nominal speed
      const amount5d = pool.nominalSpeed.mul(duration.days('5'))

      // 10 days on nominal speed + 10 days on increased speed + 5 days on second increase speed
      // 10 * 20 + 10 * 25 + 5 * 30 = 200 + 250 + 150 = 600
      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('5')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('25'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount5d.mul(5))
    })

    it('Claim after 50 days, second claim after 50 days, should return nominal', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('50'))

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('50'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.sub(amount))
    })

    it('Claim after 70 days, should return nominal + partial bonus', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('70'))

      // should return pool nominal amount + some bonus
      // 493715 sec remained to farm at bonus speed
      const expectedBonus = pool.bonusSpeed.mul(BigNumber.from('493715'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.add(expectedBonus))

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18('0')
    })
  })

  describe('Believer Pool: claimRewards() with bonusDeadlineTime', async () => {
    const poolId = 2
    beforeEach('create deposit', async () => {
      await master.allowClaim()
      await master.deposit(poolId, oneAmount)
    })

    it('Set deadline time after nominal has been farmed', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('80'))

      await master.setBonusDeadlineTime()

      await increase(duration.days('50'))

      // should return pool nominal amount + some bonus
      // 1357716 sec remained to farm at bonus speed
      const expectedBonus = pool.bonusSpeed.mul(BigNumber.from('1357716'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.add(expectedBonus))

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18('0')
    })

    it('Set deadline time before nominal has been farmed', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('50'))

      await master.setBonusDeadlineTime()

      await increase(duration.days('80'))

      // should return pool nominal amount
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount)

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18('0')
    })
  })

  describe('Advocate Pool: claimRewards()', async () => {
    const poolId = 1
    beforeEach('create deposit', async () => {
      await master.allowClaim()
      await master.deposit(poolId, oneAmount)
    })

    it('Claim after 10 days', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed

      const amount = pool.nominalSpeed.mul(duration.days('10')).add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)
    })

    it('Claim after 10 days, wait 10 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed
      const amount10d = pool.nominalSpeed.mul(duration.days('10'))

      let amount = amount10d.add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount10d)
    })
    it('2 claims after 10 days, wait 10 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed
      const amount10d = pool.nominalSpeed.mul(duration.days('10'))

      let amount = amount10d.add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))

      amount = amount.add(amount10d)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount10d)
    })

    it('Claim after 25 days, wait 25 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('25'))

      // 5 days on nominal speed
      const amount5d = pool.nominalSpeed.mul(duration.days('5'))

      // 10 days on nominal speed + 10 days on increased speed + 5 days on second increase speed
      // 10 * 20 + 10 * 25 + 5 * 30 = 200 + 250 + 150 = 600
      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('5')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('25'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount5d.mul(5))
    })

    it('Claim after 50 days, second claim after 10 days, should return nominal + partial bonus', async () => {
      const pool = await master.pools(1)

      await increase(duration.days('50'))

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('30'))

      // should return pool nominal amount + some bonus
      // 1555202 sec remained to farm at bonus speed
      const expectedBonus = pool.bonusSpeed.mul(BigNumber.from('1555202'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.add(expectedBonus).sub(amount))
    })

    it('Claim after 50 days, second claim after 50 days, should return nominal + full bonus', async () => {
      const pool = await master.pools(1)

      await increase(duration.days('50'))

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('50'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(
        pool.nominalAmount.add(pool.bonusAmount).sub(amount)
      )
    })

    it('Claim after 70 days, should return nominal + partial bonus', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('70'))

      // should return pool nominal amount + some bonus
      // 1512002 sec remained to farm at bonus speed
      const expectedBonus = pool.bonusSpeed.mul(BigNumber.from('1512002'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.add(expectedBonus))

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18('0')
    })
  })

  describe('Advocate Pool: claimRewards() with bonusDeadlineTime', async () => {
    const poolId = 1
    beforeEach('create deposit', async () => {
      await master.allowClaim()
    })

    it('Deadline before deposit, farm 10 days', async () => {
      const pool = await master.pools(poolId)

      await master.setBonusDeadlineTime()

      await increase(duration.days('10'))

      await master.deposit(poolId, oneAmount)

      // 10 days on nominal speed
      await increase(duration.days('10'))

      const amount = pool.nominalSpeed.mul(duration.days('10')).add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)
    })

    it('Deadline before deposit, claim after 50 days, second claim after 30 days, should return nominal', async () => {
      const pool = await master.pools(1)

      await master.setBonusDeadlineTime()

      await increase(duration.days('10'))

      await master.deposit(poolId, oneAmount)

      await increase(duration.days('50'))

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('30'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.sub(amount))
    })

    it('Deadline after 50 days of farm, should return nominal', async () => {
      const pool = await master.pools(1)
      await master.deposit(poolId, oneAmount)

      await increase(duration.days('50'))

      await master.setBonusDeadlineTime()

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('50'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.sub(amount))
    })

    it('Deadline after 10 days of farm, should return nominal', async () => {
      const pool = await master.pools(1)
      await master.deposit(poolId, oneAmount)

      await increase(duration.days('10'))

      await master.setBonusDeadlineTime()

      await increase(duration.days('40'))

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('50'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.sub(amount))
    })

    it('Deadline and claim after 70 days, should return nominal + partial bonus', async () => {
      const pool = await master.pools(poolId)
      await master.deposit(poolId, oneAmount)

      await increase(duration.days('70'))
      await master.setBonusDeadlineTime()

      // should return pool nominal amount + some bonus
      // 1512002 sec remained to farm at bonus speed
      const expectedBonus = pool.bonusSpeed.mul(BigNumber.from('1512002'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.add(expectedBonus))

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18('0')
    })

    it('Consecutive claims after 10 days, set deadline inbetween', async () => {
      const pool = await master.pools(poolId)
      await master.deposit(poolId, oneAmount)

      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      await master.setBonusDeadlineTime()

      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      //This claim should revert, as nominal farmed
      await increase(duration.days('10'))
      await expect(master.claimRewards(poolId)).to.be.revertedWith('GravisMaster: Zero rewards')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount)

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18('0')
    })
  })

  describe('Evangelist Pool: claimRewards()', async () => {
    const poolId = 0
    beforeEach('create deposit', async () => {
      await master.allowClaim()
      await master.deposit(poolId, oneAmount)
    })

    it('Claim after 10 days', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed

      const amount = pool.nominalSpeed.mul(duration.days('10')).add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)
    })

    it('Claim after 10 days, wait 10 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      let amount = pool.nominalSpeed.mul(duration.days('10')).add(pool.startBonusAmount)
      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('10'))
      //No speed reset, so we continue to farm at increased speed
      amount = pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount)
    })
    it('2 claims after 10 days, wait 10 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('10'))

      // 10 days on nominal speed
      let amount = pool.nominalSpeed.mul(duration.days('10')).add(pool.startBonusAmount)

      // We cant check event args due to rounding
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      let claimed = amount

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(claimed)

      await increase(duration.days('10'))

      //No speed reset, so we continue to farm at increased speed
      amount = pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10'))
      claimed = claimed.add(amount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(claimed)

      await increase(duration.days('10'))
      //No speed reset, so we continue to farm at increased speed
      amount = pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount)
    })

    it('Claim after 25 days, wait 25 days check user rewards', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('25'))

      let amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('5')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')

      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('25'))
      amount = pool.nominalSpeed
        .add(pool.speedMultiplier.mul(2))
        .mul(duration.days('5'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('20')))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(amount)
    })

    it('Claim after 50 days, second claim after 50 days, should return nominal + full bonus', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('50'))

      const amount = pool.nominalSpeed
        .mul(duration.days('10'))
        .add(pool.nominalSpeed.add(pool.speedMultiplier).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(2)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.nominalSpeed.add(pool.speedMultiplier.mul(3)).mul(duration.days('10')))
        .add(pool.startBonusAmount)

      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(amount)

      await increase(duration.days('50'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(
        pool.nominalAmount.add(pool.bonusAmount).sub(amount)
      )
    })

    it('Claim after 70 days, should return nominal + partial bonus', async () => {
      const pool = await master.pools(poolId)

      await increase(duration.days('70'))

      // should return pool nominal amount + some bonus
      // 960002 sec remained to farm at bonus speed
      const expectedBonus = pool.bonusSpeed.mul(BigNumber.from('960002'))
      await expect(master.claimRewards(poolId)).to.emit(master, 'Claim')
      expect(await token.balanceOf(deployer)).to.be.almostEqualDiv1e18(pool.nominalAmount.add(expectedBonus))

      await increase(duration.days('10'))

      expect(await master.getPoolUserRewards(poolId, deployer)).to.be.almostEqualDiv1e18(pool.bonusSpeed.mul(duration.days('10')))
    })
  })

  describe('#getDepositsByUser()', async () => {
    beforeEach('set up deposits', async () => {
      await master.allowClaim()
      await master.deposit(0, oneAmount)
      await master.deposit(0, twoAmount)
    })

    it('Should correcly return length of the deposits for VALID pool', async () => {
      const deposits = await master.getDepositsByUser(0, deployer)
      expect(deposits.length).to.be.equals(2)
    })
    it('Should correcly return length of the deposits for INVALID pool', async () => {
      const deposits = await master.getDepositsByUser(1, deployer)
      expect(deposits.length).to.be.equals(0)
    })
  })
})
