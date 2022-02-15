import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'

const bits = BigNumber.from(10).pow(BigNumber.from(18))

export const Constants = {
  Master: {
    token: '0x8E88f4f82F0bb15f8c53a2261B7b84606ca6D375',
    provider: '0xFF558Fb7DE835bFAf47b55402F1275aBCe2D8256',
    nfts: ['0x155E2aB16d5Eb9269eC526baA66B32bc5ce0f58A'],
    //nfts: ['0x1A2a8CAba8552773fC118AD8b9A0e077465082EB'],
  },
  Chef: {
    perBlock: BigNumber.from('1000').mul(bits),
    startBlock: 0,
    feeRecipient: '0xCA6a2D72869F69B0086105b2e8242463D4fe70Af',
    feeStage: [2500, 0, 0, 0, 0], // 25%, 10%,   5%,     2.5%,   1%
    feeStageDeltas: [0, 28800, 57600, 201600, 403200], // 0,   1 day, 2 days, 1 week, 2 weeks
  },
  Mutator: {
    nft: '0x1A2a8CAba8552773fC118AD8b9A0e077465082EB',
    coordinator: '0xa555fC018435bef5A13C6c6870a9d4C11DEC329C',
    link: '0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06',
    fee: ethers.utils.parseEther('0.1'),
    keyHash: '0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186',
  },
}
