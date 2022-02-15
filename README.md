# Gravis Finance Gswap Farming Contracts

This contract is a farming contract. The 0 pool in this contract is the Gravis Finance Token X stack. 

This contract is used by reference: https://farming.gravis.finance/

Links to contracts in the networks: 

BSC: https://bscscan.com/address/0x68671Ee67A6EBB95AB737c389D73e99BdAfAA917

Polygon: https://polygonscan.com/address/0x9d8718a14fcd3fd71e7fa7ba6b8d9f813e168807

### Gswap Farming

#### Deployment

To deploy the contract you need to provide following params:

1. Reward token address, should be ERC20 token.
2. Per block reward in wei.
3. Block number when farming starts.
4. Fee collector address.
5. Array of fee stages in basis points: `[2500, 1000, 500, 250, 100]` which eq `[25%, 10%, 5%, 2.5%, 1%]`. 25% is the slashing fee to prevent flashloans.
6. Array of block number count which associated with fee stages: `[0, 28800, 57600, 201600, 403200]` which eq `[0, 1 day, 2 days,1 week, 2 weeks]`. To calculate this values you should use that for BSC network there is 1 block each 3 seconds, which makes 1200 block per hour.

Fee works this way:

- if user withdraw/unstake at the same block as deposit/stake, there is a slashing fee of 25% to prevent flashloans.
- if `current block - user deposit block is between 0 and 28800` (user staked for less then 1 day), then withdrawal fee is 10%
  ...
- if `current block - user deposit block > 403200 (2 weeks)`, there is no fee.

After deployment of the contract, a special pool with pid = 0 created. This pool also knows as 'staking pool' used to stake/unstake GRVX token.

###### !!! Don't forget that you need to grant minter role for the Chef contract inside your GRVX token contract.

#### Deposit/Withdraw

Users can deposit LP token by using `deposit` method, with following params:

- poolId
- lp token amount in wei

Users can withdraw LP token by using `withdraw` method, with following params:

- poolId
- lp token amount in wei

Rewards are automatically claimed for this pool on withdrawals or on consecutive deposits.

#### Stake/Unstake

Users can deposit GRVX token by using `stake` method, with following params:

- GRVX token amount in wei

Users can unstake GRVX token by using `unstake` method, with following params:

- GRVX token amount in wei

Rewards are automatically claimed for this pool on unstake or on consecutive stakes.

#### Claim

There are two methods to claim rewards from the Chef contract.

The first one is `claimRewards` method, you can call it with following params:

- array of pool ids `[0,1,6,...]`

Rewards will be claimed for the given pools. You can remove inactive pools from claiming by passing only active pool ids. (inactive pool is the pool with zero allocation points)

The second one is `claimReward` method, you can call it with following params:

- pool id

#### Contracts deployment cost

```
·-----------------------------------------------|---------------------------|-------------|-----------------------------·
|             Solc version: 0.6.12              ·  Optimizer enabled: true  ·  Runs: 200  ·  Block limit: 12450000 gas  │
················································|···························|·············|······························
|  Methods                                      ·              100 gwei/gas               ·       1877.38 usd/eth       │
······················|·························|·············|·············|·············|···············|··············
|  Contract           ·  Method                 ·  Min        ·  Max        ·  Avg        ·  # calls      ·  usd (avg)  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  add                    ·     129360  ·     191776  ·     145269  ·           29  ·      27.27  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  claimRewards           ·          -  ·          -  ·     157814  ·            2  ·      29.63  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  deposit                ·      72198  ·     155185  ·     135594  ·           25  ·      25.46  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  emergencyWithdraw      ·      56048  ·      58596  ·      57322  ·            4  ·      10.76  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  set                    ·      38200  ·      43202  ·      40701  ·            4  ·       7.64  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  setBlockDeltaFeeStage  ·          -  ·          -  ·      38842  ·            1  ·       7.29  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  setFeeRecipient        ·          -  ·          -  ·      29046  ·            1  ·       5.45  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  setFeeStage            ·          -  ·          -  ·      38841  ·            1  ·       7.29  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  setMultiplier          ·          -  ·          -  ·      28757  ·            1  ·       5.40  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  setTokenPerBlock       ·          -  ·          -  ·      28825  ·            1  ·       5.41  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  stake                  ·      79412  ·     171410  ·     155396  ·           24  ·      29.17  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  unstake                ·      34707  ·     185041  ·     104326  ·           18  ·      19.59  │
······················|·························|·············|·············|·············|···············|··············
|  GravisChef         ·  withdraw               ·      34941  ·     205891  ·     129606  ·           18  ·      24.33  │
······················|·························|·············|·············|·············|···············|··············
|  GravisMaster       ·  allowClaim             ·          -  ·          -  ·      28498  ·           34  ·       5.35  │
······················|·························|·············|·············|·············|···············|··············
|  GravisMaster       ·  claimRewards           ·     103702  ·     167264  ·     149625  ·           75  ·      28.09  │
······················|·························|·············|·············|·············|···············|··············
|  GravisMaster       ·  deposit                ·     143827  ·     197836  ·     188610  ·           47  ·      35.41  │
······················|·························|·············|·············|·············|···············|··············
|  GravisMaster       ·  pause                  ·          -  ·          -  ·      28001  ·            4  ·       5.26  │
······················|·························|·············|·············|·············|···············|··············
|  GravisMaster       ·  setBonusDeadlineTime   ·          -  ·          -  ·      45631  ·            9  ·       8.57  │
······················|·························|·············|·············|·············|···············|··············
|  GravisMaster       ·  unpause                ·          -  ·          -  ·      28005  ·            2  ·       5.26  │
······················|·························|·············|·············|·············|···············|··············
|  GravisTokenX       ·  approve                ·      46123  ·      46135  ·      46134  ·           48  ·       8.66  │
······················|·························|·············|·············|·············|···············|··············
|  GravisTokenX       ·  grantRole              ·      78729  ·      78741  ·      78740  ·           48  ·      14.78  │
······················|·························|·············|·············|·············|···············|··············
|  GravisTokenX       ·  mint                   ·          -  ·          -  ·      73158  ·           48  ·      13.73  │
······················|·························|·············|·············|·············|···············|··············
|  Deployments                                  ·                                         ·  % of limit   ·
│
················································|·············|·············|·············|···············|··············
|  GravisChef                                   ·    2785802  ·    2785814  ·    2785814  ·       22.4 %  ·     523.00  │
················································|·············|·············|·············|···············|··············
|  GravisMaster                                 ·    2713125  ·    2713149  ·    2713148  ·       21.8 %  ·     509.36  │
················································|·············|·············|·············|···············|··············
|  GravisTokenX                                 ·          -  ·          -  ·    1710293  ·       13.7 %  ·     321.09  │
·-----------------------------------------------|-------------|-------------|-------------|---------------|-------------·
```

#### Test coverage report

```
-------------------------|----------|----------|----------|----------|----------------|
File                     |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
-------------------------|----------|----------|----------|----------|----------------|
 contracts/              |    98.71 |    96.62 |    95.65 |    98.68 |                |
  GravisChef.sol         |     98.9 |    97.67 |      100 |    98.88 |        443,509 |
  GravisMaster.sol       |    99.21 |    95.16 |      100 |    99.19 |            365 |
  GravisToken.sol        |        0 |      100 |        0 |        0 |             15 |
  GravisTokenX.sol       |      100 |      100 |      100 |      100 |                |
 contracts/interfaces/   |      100 |      100 |      100 |      100 |                |
  IGravisCollectible.sol |      100 |      100 |      100 |      100 |                |
-------------------------|----------|----------|----------|----------|----------------|
All files                |    98.71 |    96.62 |    95.65 |    98.68 |                |
-------------------------|----------|----------|----------|----------|----------------|
```


#### Deploy GravisChef

```
yarn deploy --network bsctest --tags Chef

yarn verify --network bsctest 0xC1A265f839d7f48c905fB19533043E97D9c54d7b --constructor-args src/004_arguments.js
```
