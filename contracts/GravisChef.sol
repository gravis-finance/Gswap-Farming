// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import './GravisTokenX.sol';

contract GravisChef is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 rewardDebtAtBlock; // the last block user stake
        uint256 lastWithdrawBlock; // the last block user withdrew at.
        uint256 firstDepositBlock; // the first block user deposited at.
        uint256 lastDepositBlock; // the last block user deposited at.
        uint256 unlockBlock; // the block number when lp unlocked.
        //
        // We do some fancy math here. Basically, any point in time, the amount of Tokens
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accTokenPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accTokenPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool.
        uint256 lastRewardBlock; // Last block number that tokens distribution occurs.
        uint256 accTokenPerShare; // Accumulated tokens per share, times 1e12. See below.
        uint256 lockPeriod; // Lock period fro lp tokens in blocks
    }
    // Basis point base to calculate fees
    uint256 public constant FEE_BASE = 10000;

    // Reward token instnace
    GravisTokenX public gravisToken;

    // Address where all fees goes, can be adjusted by the owner
    address public feeRecipient;

    // Reward token per block, can be adjusted by the owner
    uint256 public tokenPerBlock;

    // Reward bonus multipliers, can be adjusted by the owner
    uint256 public bonusMultiplier = 1;

    // The block number when rewards starts.
    uint256 public startBlock;

    // Pools array
    PoolInfo[] public poolInfo;

    // Users mapping, poolId => userAddress => UserInfo
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;

    // Total deposited tokens
    uint256 public depositedTokens;

    // Array with fee amount (in basis points) for given stage
    uint256[] public feeStage;

    // Array with block deltas, used to calculate fee stage,
    uint256[] public blockDeltaFeeStage;

    // Mapping to track pool existence
    mapping(IERC20 => bool) public poolExistence;

    event PoolAdd(address indexed token, uint256 indexed allocPoint);
    event PoolUpdate(uint256 indexed pid, uint256 indexed allocPoint);
    event PoolLockUpdate(uint256 indexed pid, uint256 indexed lock);
    event PoolRemoved(uint256 indexed pid);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);

    /**
     * @dev Throws if pool for lp already exists.
     */
    modifier nonDuplicated(IERC20 _lpToken) {
        require(!poolExistence[_lpToken], 'GravisChef: Pool already exists');
        _;
    }

    constructor(
        GravisTokenX _token,
        uint256 _perBlock,
        uint256 _startBlock,
        address _feeRecipient,
        uint256[] memory _feeStage,
        uint256[] memory _blockDeltaFeeStage
    ) public {
        gravisToken = _token;
        feeRecipient = _feeRecipient;
        tokenPerBlock = _perBlock;
        startBlock = _startBlock;
        feeStage = _feeStage;
        blockDeltaFeeStage = _blockDeltaFeeStage;
        // Add pool as 0 index, to stake GravisToken
        poolInfo.push(PoolInfo({ lpToken: _token, allocPoint: 1000, lastRewardBlock: startBlock, accTokenPerShare: 0, lockPeriod: 0 }));
        poolExistence[_token] = true;
        totalAllocPoint = 1000;

        emit PoolAdd(address(_token), 1000);
    }

    /**
     * @dev Adds a new pool. Can only be called by the owner.
     */
    function add(
        uint256 _allocPoint,
        IERC20 _lpToken,
        uint256 _lock,
        bool _withUpdate
    ) external onlyOwner nonDuplicated(_lpToken) {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolExistence[_lpToken] = true;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accTokenPerShare: 0,
                lockPeriod: _lock
            })
        );
        emit PoolAdd(address(_lpToken), _allocPoint);
    }

    /**
     * @dev Updates pool allocation points. Can only be called by the owner.
     */
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        emit PoolUpdate(_pid, _allocPoint);
    }

    /**
     * @dev Updates pool allocation points. Can only be called by the owner.
     */
    function setLock(
        uint256 _pid,
        uint256 _lock,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        poolInfo[_pid].lockPeriod = _lock;
        emit PoolLockUpdate(_pid, _lock);
    }

    /**
     * @dev Removes pool from the array if the pool is empty. Can only be called by the owner.
     */
    function del(uint256 _pid, bool _withUpdate) external onlyOwner {
        require(_pid < poolInfo.length, 'GravisChef: Pool not exists');
        require(_pid != 0, 'GravisChef: Staking pool');
        require(poolInfo[_pid].allocPoint == 0, 'GravisChef: Pool is active');

        uint256 lpSupply = poolInfo[_pid].lpToken.balanceOf(address(this));
        require(lpSupply == 0, 'GravisChef: Pool not empty');

        if (_withUpdate) {
            massUpdatePools();
        }

        poolInfo[_pid] = poolInfo[poolInfo.length - 1];
        poolInfo.pop();

        emit PoolRemoved(_pid);
    }

    /**
     * @dev Updates reward vairables for all pools. Be careful of gas spending!
     */
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /**
     * @dev Updates reward vairables for the pool.
     */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];

        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (_pid == 0) {
            lpSupply = depositedTokens;
        }

        if (lpSupply <= 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 reward = multiplier.mul(tokenPerBlock).mul(pool.allocPoint).div(totalAllocPoint);

        pool.accTokenPerShare = pool.accTokenPerShare.add(reward.mul(1e12).div(lpSupply));
        pool.lastRewardBlock = block.number;

        gravisToken.mint(address(this), reward);
    }

    /**
     * @dev Deposit LP tokens to GravisChef for reward token allocation.
     */
    function deposit(uint256 _pid, uint256 _amount) external nonReentrant {
        require(_pid != 0, 'GravisChef: Deposit to the staking pool');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                safeTokenTransfer(msg.sender, pending);
            }
        }

        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        
        if (user.amount == 0) {
            user.unlockBlock = block.number.add(pool.lockPeriod);
        }

        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        if (user.firstDepositBlock == 0) {
            user.firstDepositBlock = block.number;
        }
        user.lastDepositBlock = block.number;

        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
     * @dev Withdraw LP tokens from GravisChef.
     */
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
        require(_pid != 0, 'GravisChef: Withdraw from the staking pool');

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(user.amount >= _amount, 'GravisChef: Withdraw amount exceeds user amount');

        updatePool(_pid);

        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);

        if (pending > 0) {
            safeTokenTransfer(msg.sender, pending);
        }

        if (_amount > 0) {
            require(user.unlockBlock <= block.number, 'GravisChef: Withdraw locked');

            uint256 fee = getWithdrawalFee(_pid, msg.sender);

            uint256 amount = applyFee(fee, _amount);
            uint256 feeAmount = calculateFee(fee, _amount);

            user.amount = user.amount.sub(_amount);
            user.lastWithdrawBlock = block.number;

            pool.lpToken.safeTransfer(address(msg.sender), amount);
            if (feeAmount > 0) {
                pool.lpToken.safeTransfer(address(feeRecipient), feeAmount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        emit Withdraw(msg.sender, _pid, _amount);
    }

    /**
     * @dev Stake GravisToken to GravisChef for reward token allocation.
     */
    function stake(uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];

        updatePool(0);

        if (user.amount > 0) {
            uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                safeTokenTransfer(msg.sender, pending);
            }
        }

        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);

        depositedTokens = depositedTokens.add(_amount);

        if (user.amount == 0) {
            user.unlockBlock = block.number.add(pool.lockPeriod);
        }

        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        if (user.firstDepositBlock == 0) {
            user.firstDepositBlock = block.number;
        }
        user.lastDepositBlock = block.number;

        emit Deposit(msg.sender, 0, _amount);
    }

    /**
     * @dev Unstake GravisToken from GravisChef.
     */
    function unstake(uint256 _amount) public nonReentrant {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];

        require(user.amount >= _amount, 'GravisChef: Unstake amount exceeds user amount');

        updatePool(0);

        uint256 pending = user.amount.mul(pool.accTokenPerShare).div(1e12).sub(user.rewardDebt);

        if (pending > 0) {
            safeTokenTransfer(msg.sender, pending);
        }

        if (_amount > 0) {
            require(user.unlockBlock <= block.number, 'GravisChef: Withdraw locked');

            uint256 fee = getWithdrawalFee(0, msg.sender);

            uint256 amount = applyFee(fee, _amount);
            uint256 feeAmount = calculateFee(fee, _amount);

            user.amount = user.amount.sub(_amount);
            user.lastWithdrawBlock = block.number;

            depositedTokens = depositedTokens.sub(_amount);

            pool.lpToken.safeTransfer(address(msg.sender), amount);
            if (feeAmount > 0) {
                pool.lpToken.safeTransfer(address(feeRecipient), feeAmount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accTokenPerShare).div(1e12);

        emit Withdraw(msg.sender, 0, _amount);
    }

    /**
     * @dev Withdraw without caring about rewards. EMERGENCY ONLY.
     * This has 25% slashing fee as same block withdrawals to prevent abuse of this function.
     */
    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 amount = applyFee(feeStage[0], user.amount);
        uint256 feeAmount = calculateFee(feeStage[0], user.amount);

        user.amount = 0;
        user.rewardDebt = 0;

        pool.lpToken.safeTransfer(address(msg.sender), amount);
        pool.lpToken.safeTransfer(address(feeRecipient), feeAmount);

        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    /**
     * @dev Claim rewards from all passed pool ids
     */
    function claimRewards(uint256[] memory _pids) external {
        for (uint256 i = 0; i < _pids.length; i++) {
            claimReward(_pids[i]);
        }
    }

    /**
     * @dev Claim reward from given pool id
     */
    function claimReward(uint256 _pid) public {
        if (_pid == 0) {
            unstake(0);
        } else {
            withdraw(_pid, 0);
        }
    }

    /**
     * @dev Updates reward multiplier, only owner.
     */
    function setMultiplier(uint256 _multiplier) external onlyOwner {
        require(_multiplier > 0, 'GravisChef: Zero multiplier');
        bonusMultiplier = _multiplier;
    }

    /**
     * @dev Updates fee recipient, only owner.
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), 'GravisChef: Zero fee recipient');
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Updates reward per block, only owner.
     */
    function setTokenPerBlock(uint256 _amount) external onlyOwner {
        // require(_amount <= 30 * 1e18, 'GravisChef: Max per block 30 tokens');
        // require(_amount >= 1 * 1e18, 'GravisChef: Min per block 1 token');
        tokenPerBlock = _amount;
    }

    /**
     * @dev Updates fee stage, only owner.
     * i.e. [2500,400,300,200,100] = [25%,4%,3%,2%,1%]
     * must be length of 5
     */
    function setFeeStage(uint256[] memory _feeStage) external onlyOwner {
        require(_feeStage.length == feeStage.length, 'GravisChef: FeeStage array mismatch');
        feeStage = _feeStage;
    }

    /**
     * @dev Updates block delta fee stage array, only owner.
     * i.e. [0,1200,2400,3600,4800] for BSC 1200 block ~ 1 hour
     * must be length of 5
     */
    function setBlockDeltaFeeStage(uint256[] memory _blockDeltas) external onlyOwner {
        require(_blockDeltas.length == blockDeltaFeeStage.length, 'GravisChef: BlockDeltaFeeStage array mismatch');
        blockDeltaFeeStage = _blockDeltas;
    }

    /**
     * @dev Safe token transfer function, just in case if rounding error
     * causes pool to not have enough token balance.
     */
    function safeTokenTransfer(address _to, uint256 _amount) internal {
        uint256 balance = gravisToken.balanceOf(address(this));
        if (_amount > balance) {
            gravisToken.transfer(_to, balance);
        } else {
            gravisToken.transfer(_to, _amount);
        }
    }

    /**
     * @dev Returns the poolInfo length.
     */
    function getPoolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @dev Returns reward multiplier over the given _from to _to block.
     */
    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _to.sub(_from).mul(bonusMultiplier);
    }

    /**
     * @dev Returns pending rewards for user.
     */
    function getPendingRewards(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTokenPerShare = pool.accTokenPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (_pid == 0) {
            lpSupply = depositedTokens;
        }
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 reward = multiplier.mul(tokenPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accTokenPerShare = accTokenPerShare.add(reward.mul(1e12).div(lpSupply));
        }
        return user.amount.mul(accTokenPerShare).div(1e12).sub(user.rewardDebt);
    }

    /**
     * @dev it calculates (1 - fee) * amount
     * Applies the fee by subtracting fees from the amount and returns
     * the amount after deducting the fee.
     */
    function applyFee(uint256 _feeInBips, uint256 _amount) internal pure returns (uint256) {
        return _amount.mul(FEE_BASE.sub(_feeInBips)).div(FEE_BASE);
    }

    /**
     * @dev it calculates fee * amount
     * Calculates the fee amount.
     */
    function calculateFee(uint256 _feeInBips, uint256 _amount) internal pure returns (uint256) {
        return _amount.mul(_feeInBips).div(FEE_BASE);
    }

    /**
     * @dev Get withdrawal fee in basis points for the user of the given pool.
     */
    function getWithdrawalFee(uint256 _pid, address _user) internal view returns (uint256) {
        uint256 userBlockDelta = getUserDelta(_pid, _user);

        uint256 fee;

        if (userBlockDelta == 0 || userBlockDelta <= blockDeltaFeeStage[0]) {
            //25% fee for withdrawals in the same block to prevent abuse from flashloans
            fee = feeStage[0];
        } else if (userBlockDelta > blockDeltaFeeStage[0] && userBlockDelta <= blockDeltaFeeStage[1]) {
            fee = feeStage[1];
        } else if (userBlockDelta > blockDeltaFeeStage[1] && userBlockDelta <= blockDeltaFeeStage[2]) {
            fee = feeStage[2];
        } else if (userBlockDelta > blockDeltaFeeStage[2] && userBlockDelta <= blockDeltaFeeStage[3]) {
            fee = feeStage[3];
        } else if (userBlockDelta > blockDeltaFeeStage[3] && userBlockDelta <= blockDeltaFeeStage[4]) {
            fee = feeStage[4];
        }

        return fee;
    }

    /**
     * @dev Get user blocks delta from last deposit block to current block.
     */
    function getUserDelta(uint256 _pid, address _user) internal view returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        if (user.lastWithdrawBlock > 0) {
            uint256 estDelta = block.number.sub(user.lastWithdrawBlock);
            return estDelta;
        } else {
            uint256 estDelta = block.number.sub(user.firstDepositBlock);
            return estDelta;
        }
    }
}
