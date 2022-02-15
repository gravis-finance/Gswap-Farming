// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Pausable.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721Holder.sol';

import './interfaces/IGravisCollectible.sol';

contract GravisMaster is ERC721Holder, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    uint256 constant SPEED_INCREASE_PERIOD = 10 days;

    enum PoolType {
        Believer,
        Advocate,
        Evangelist
    }

    struct PoolInfo {
        address nft;
        uint256 id;
        uint256 nominalAmount;
        uint256 startBonusAmount;
        uint256 nominalSpeed;
        uint256 speedMultiplier;
        uint256 speedMultiplierCount;
        uint256 bonusAmount;
        uint256 bonusSpeed;
        PoolType poolType;
    }

    struct ClaimPenalty {
        bool nominalPenalty;
        bool bonusPenalty;
        bool canFarmBonusAfterClaim;
    }

    struct DepositInfo {
        uint256 amount;
        uint256 depositTime;
        uint256 claimTime;
        uint256 claimed;
    }

    IERC20 public token;
    address public tokenProvider;
    bool public claimAllowed;
    Counters.Counter public depositIds;
    PoolInfo[] public pools;

    uint256 public bonusDeadlineTime;

    // Info of each user that stakes NFT. pid => deposit id => info
    mapping(uint256 => mapping(uint256 => DepositInfo)) private _deposits;
    // Mapping to track user => array of deposits ids
    mapping(address => uint256[]) private _userDeposits;

    event Deposit(address indexed user, uint256 indexed poolId, uint256 indexed amount);
    event Claim(address indexed user, uint256 indexed poolId, uint256 indexed amount);

    constructor(
        address _token,
        address _provider,
        address[] memory _nfts
    ) public {
        token = IERC20(_token);
        tokenProvider = _provider;

        // Evangelist Pool
        pools.push(
            PoolInfo({
                nft: _nfts[0],
                id: 0,
                nominalAmount: uint256(9600).mul(1e18),
                startBonusAmount: uint256(1600).mul(1e18),
                nominalSpeed: uint256(120).mul(1e18).div(1 days),
                speedMultiplier: uint256(20).mul(1e18).div(1 days),
                speedMultiplierCount: 3,
                bonusAmount: uint256(3000).mul(1e18),
                bonusSpeed: uint256(100).mul(1e18).div(1 days),
                poolType: PoolType.Evangelist
            })
        );

        // Advocate Pool
        pools.push(
            PoolInfo({
                nft: _nfts[0],
                id: 1,
                nominalAmount: uint256(4600).mul(1e18),
                startBonusAmount: uint256(600).mul(1e18),
                nominalSpeed: uint256(50).mul(1e18).div(1 days),
                speedMultiplier: uint256(10).mul(1e18).div(1 days),
                speedMultiplierCount: 3,
                bonusAmount: uint256(1350).mul(1e18),
                bonusSpeed: uint256(45).mul(1e18).div(1 days),
                poolType: PoolType.Advocate
            })
        );

        // Believer Pool
        pools.push(
            PoolInfo({
                nft: _nfts[0],
                id: 2,
                nominalAmount: uint256(2200).mul(1e18),
                startBonusAmount: uint256(200).mul(1e18),
                nominalSpeed: uint256(20).mul(1e18).div(1 days),
                speedMultiplier: uint256(5).mul(1e18).div(1 days),
                speedMultiplierCount: 3,
                bonusAmount: uint256(600).mul(1e18),
                bonusSpeed: uint256(20).mul(1e18).div(1 days),
                poolType: PoolType.Believer
            })
        );
    }

    function getDepositsByUser(uint256 _pid, address _user) public view returns (DepositInfo[] memory) {
        uint256 totalDeposits;

        for (uint256 i = 0; i < _userDeposits[_user].length; i++) {
            if (isDepositExists(_deposits[_pid][_userDeposits[_user][i]])) {
                totalDeposits = totalDeposits.add(1);
            }
        }

        uint256 depositIndex;
        DepositInfo[] memory userDeposits = new DepositInfo[](totalDeposits);

        for (uint256 i = 0; i < _userDeposits[_user].length; i++) {
            if (isDepositExists(_deposits[_pid][_userDeposits[_user][i]])) {
                userDeposits[depositIndex] = _deposits[_pid][_userDeposits[_user][i]];
                depositIndex = depositIndex.add(1);
            }
        }
        return userDeposits;
    }

    /**
     * @dev Public function to deposit nft token to the given pool
     * @param _pid Pool Id
     * @param _amount Tokens amount
     */
    function deposit(uint256 _pid, uint256 _amount) public whenNotPaused nonReentrant {
        require(_pid <= 2, 'GravisMaster: Invalid Pool Id');
        require(_amount > 0, 'GravisMaster: Zero amount');

        PoolInfo storage pool = pools[_pid];

        IGravisCollectible(pool.nft).transferFor(_msgSender(), address(this), pool.id, _amount);

        depositIds.increment();

        _deposits[_pid][depositIds.current()] = DepositInfo(_amount, block.timestamp, 0, 0);

        _userDeposits[_msgSender()].push(depositIds.current());

        emit Deposit(_msgSender(), _pid, _amount);
    }

    /**
     * @dev Get user rewards for the given pool
     * @param _pid Pool Id
     * @param _user User address
     * @return rewards
     */
    function getPoolUserRewards(uint256 _pid, address _user) public view returns (uint256 rewards) {
        for (uint256 i = 0; i < _userDeposits[_user].length; i++) {
            rewards = rewards.add(getRewardsForDeposit(_pid, _userDeposits[_user][i]));
        }
    }

    /**
     * @dev Internal function to check if current deposit exists
     * @param info DepositInfo struct
     * @return depositExists
     */
    function isDepositExists(DepositInfo memory info) internal pure returns (bool) {
        return info.amount > 0 && info.depositTime > 0;
    }

    /**
     * @dev Internal function to calculate average farming speed
     * @param fromTime Start period time
     * @param toTime End period time
     * @param pool PoolInfo struct
     * @return averageSpeed
     */
    function getAverageSpeed(
        uint256 fromTime,
        uint256 toTime,
        PoolInfo memory pool
    ) internal pure returns (uint256) {
        uint256 timeDiff = toTime.sub(fromTime);

        uint256 periodsCount = timeDiff.div(SPEED_INCREASE_PERIOD);
        uint256 leftoverTime = timeDiff % SPEED_INCREASE_PERIOD;

        uint256 amount;
        uint256 currentSpeed = pool.nominalSpeed;

        for (uint256 i = 1; i <= periodsCount; i++) {
            amount = amount.add(SPEED_INCREASE_PERIOD.mul(currentSpeed));
            if (i <= pool.speedMultiplierCount) {
                currentSpeed = currentSpeed.add(pool.speedMultiplier);
            }
        }

        if (leftoverTime > 0) {
            amount = amount.add(leftoverTime.mul(currentSpeed));
        }
        // average speed = (SPEED_INCREASE_PERIOD * s1 ... + leftoverTime * sn) / timeDiff

        return periodsCount == 0 ? pool.nominalSpeed : amount.div(timeDiff);
    }

    /**
     * @dev Internal function to calculate time needed to farm nominal amount
     * @param pool PoolInfo struct
     * @return time
     */
    function getTimeToFarmNominal(PoolInfo memory pool) internal pure returns (uint256 time) {
        uint256 currentSpeed = pool.nominalSpeed;
        uint256 amount = pool.startBonusAmount;
        uint256 remainingAmount;

        for (uint256 i = 1; i <= 10; i++) {
            // nominal is reached
            if (amount.add(SPEED_INCREASE_PERIOD.mul(currentSpeed)) >= pool.nominalAmount) {
                // how many tokens we need to farm until nominal
                remainingAmount = amount.add(currentSpeed.mul(SPEED_INCREASE_PERIOD)).sub(pool.nominalAmount);
                // how many seconds to farm this amount at current speed
                return time.add(remainingAmount.div(currentSpeed));
            }

            amount = amount.add(SPEED_INCREASE_PERIOD.mul(currentSpeed));
            time = time.add(SPEED_INCREASE_PERIOD);

            if (i <= pool.speedMultiplierCount) {
                currentSpeed = currentSpeed.add(pool.speedMultiplier);
            }
        }
    }

    /**
     * @dev Internal helper function to calculate farm amount for given deposit without claims
     * @dev see getRewardsForDeposit
     * @param _pid Pool Id
     * @param _depositIndex Deposit index, to get DepositInfo struct from array
     * @return reward
     */
    function getRewardsForDepositWithoutClaim(uint256 _pid, uint256 _depositIndex) internal view returns (uint256 reward) {
        PoolInfo memory pool = pools[_pid];

        DepositInfo memory info = _deposits[_pid][_depositIndex];

        // Excessive check, same check in getRewardsForDeposit
        // if (!isDepositExists(info)) {
        //     return 0;
        // }

        reward = reward.add(pool.startBonusAmount);

        uint256 timeDiff = block.timestamp.sub(info.depositTime);
        uint256 timeToFarmNominal = getTimeToFarmNominal(pool);

        bool canFarmBonus = true;

        // deadline after nominal farmed
        // adjust timeDiff
        if (bonusDeadlineTime > 0 && bonusDeadlineTime > info.depositTime.add(timeToFarmNominal)) {
            timeDiff = bonusDeadlineTime.sub(info.depositTime);
        } else if (bonusDeadlineTime > 0 && bonusDeadlineTime < info.depositTime.add(timeToFarmNominal)) {
            // deadline before nominal farmed
            // switch flag
            canFarmBonus = false;
        }

        // If nominal is farmed, farm bonus
        if (timeDiff > timeToFarmNominal) {
            reward = pool.nominalAmount;
            if (canFarmBonus) {
                timeDiff = timeDiff.sub(timeToFarmNominal);
                if (pool.bonusSpeed.mul(timeDiff) >= pool.bonusAmount) {
                    reward = reward.add(pool.bonusAmount);
                } else {
                    reward = reward.add(pool.bonusSpeed.mul(timeDiff));
                }
            }
        } else {
            uint256 averageSpeed = getAverageSpeed(info.depositTime, block.timestamp, pool);
            reward = reward.add(averageSpeed.mul(timeDiff));
        }

        reward = reward.mul(info.amount).sub(info.claimed);
    }

    /**
     * @dev Internal function to calculate farm amount for given deposit
     * @dev Used to calculate farms for all pools
     * @param _pid Pool Id
     * @param _depositIndex Deposit index, to get DepositInfo struct from array
     * @return reward
     */
    function getRewardsForDeposit(uint256 _pid, uint256 _depositIndex) internal view returns (uint256 reward) {
        PoolInfo memory pool = pools[_pid];

        DepositInfo memory info = _deposits[_pid][_depositIndex];

        if (!isDepositExists(info)) {
            return 0;
        }

        reward = reward.add(pool.startBonusAmount);

        uint256 timeDiff = block.timestamp.sub(info.depositTime);
        uint256 timeToFarmNominal;
        uint256 claimPerToken = info.claimed.div(info.amount);

        if (pool.poolType == PoolType.Believer && info.claimTime > 0) {
            // Believer pool
            // - reset speed to nominal if claimed any time
            // - can not farm bonus if claimed
            if (claimPerToken <= pool.nominalAmount) {
                // Claimed at nominal stage
                timeDiff = block.timestamp.sub(info.claimTime);
                reward = claimPerToken.add(pool.nominalSpeed.mul(timeDiff));
                if (reward > pool.nominalAmount) {
                    reward = pool.nominalAmount;
                }
            } else {
                // Claimed at bonus stage
                reward = claimPerToken;
            }
            reward = reward.mul(info.amount).sub(info.claimed);
        } else if (pool.poolType == PoolType.Advocate && info.claimTime > 0) {
            // Advocate pool
            // - reset speed to nominal if claimed any time
            // - can farm bonus if claimed at nominal stage
            // - cannot farm bonus if claimed at bonus stage
            if (claimPerToken <= pool.nominalAmount) {
                // Claimed at nominal stage
                timeDiff = block.timestamp.sub(info.claimTime);
                reward = claimPerToken.add(pool.nominalSpeed.mul(timeDiff));
                if (reward > pool.nominalAmount) {
                    // Nominal farmed, proceed with farming bonus
                    timeToFarmNominal = pool.nominalAmount.sub(claimPerToken).div(pool.nominalSpeed);
                    reward = pool.nominalAmount;
                    timeDiff = timeDiff.sub(timeToFarmNominal);

                    bool canFarmBonus = true;
                    // deadline after nominal farmed
                    // adjust timeDiff
                    if (bonusDeadlineTime > 0 && bonusDeadlineTime > info.claimTime.add(timeToFarmNominal)) {
                        timeDiff = bonusDeadlineTime.sub(info.claimTime).sub(timeToFarmNominal);
                    } else if (bonusDeadlineTime > 0 && bonusDeadlineTime < info.claimTime.add(timeToFarmNominal)) {
                        // deadline before nominal farmed
                        // switch flag
                        canFarmBonus = false;
                    }
                    if (canFarmBonus) {
                        if (pool.bonusSpeed.mul(timeDiff) >= pool.bonusAmount) {
                            reward = reward.add(pool.bonusAmount);
                        } else {
                            reward = reward.add(pool.bonusSpeed.mul(timeDiff));
                        }
                    }
                }
            } else {
                // Claimed at bonus stage
                reward = claimPerToken;
            }
            reward = reward.mul(info.amount).sub(info.claimed);
        } else if (pool.poolType == PoolType.Evangelist && info.claimTime > 0) {
            // Evangelist pool
            // - no speed reset
            // - can farm bonus if claimed at nominal stage
            // - can farm bonus if claimed at bonus stage
            reward = getRewardsForDepositWithoutClaim(_pid, _depositIndex);
        } else {
            // Not claimed, calculate farm as usual
            reward = getRewardsForDepositWithoutClaim(_pid, _depositIndex);
        }
    }

    /**
     * @dev Internal helper function to claim reward for given deposit
     * @dev Modifies the state
     * @dev see claimRewards
     * @param _pid Pool Id
     * @param _depositIndex Deposit index, to get DepositInfo struct from array
     * @return reward
     */
    function claimRewardsFromDeposit(uint256 _pid, uint256 _depositIndex) internal returns (uint256 reward) {
        reward = getRewardsForDeposit(_pid, _depositIndex);
        if (reward > 0) {
            DepositInfo storage info = _deposits[_pid][_depositIndex];
            info.claimed = info.claimed.add(reward);
            info.claimTime = block.timestamp;
        }
    }

    /**
     * @dev Public function to claim reward for the given pool
     * @dev Iterates through user deposits and claims all rewards for every deposit
     * @dev see claimRewardsFromDeposit
     * @param _pid Pool Id
     */
    function claimRewards(uint256 _pid) public whenNotPaused nonReentrant {
        require(claimAllowed, 'GravisMaster: Claim not allowed');
        require(_userDeposits[_msgSender()].length > 0, 'GravisMaster: No deposits');

        uint256 totalRewards;
        for (uint256 i = 0; i < _userDeposits[_msgSender()].length; i++) {
            totalRewards = totalRewards.add(claimRewardsFromDeposit(_pid, _userDeposits[_msgSender()][i]));
        }

        require(totalRewards > 0, 'GravisMaster: Zero rewards');
        require(token.balanceOf(tokenProvider) >= totalRewards, 'GravisMaster: Not enough tokens');

        token.safeTransferFrom(tokenProvider, _msgSender(), totalRewards);

        emit Claim(_msgSender(), _pid, totalRewards);
    }

    /**
     * @dev Switch the claim allowed flag (owner only)
     */
    function allowClaim() public onlyOwner {
        claimAllowed = true;
    }

    /**
     * @dev Set bonus deadline time to current time (owner only)
     */
    function setBonusDeadlineTime() public onlyOwner {
        require(bonusDeadlineTime == 0, 'GravisMaster: Bonus deadline time already set');
        bonusDeadlineTime = block.timestamp;
    }

    /**
     * @dev Pause all activity of deposit and claim rewards fucntions (owner only)
     */
    function pause() public onlyOwner whenNotPaused {
        _pause();
    }

    /**
     * @dev Unpause all activity of deposit and claim rewards fucntions (owner only)
     */
    function unpause() public onlyOwner whenPaused {
        _unpause();
    }
}
