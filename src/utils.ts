import { ContractReceipt, utils, Event } from 'ethers'

export const formatTokenBalance = (address: string, balance: number, decimals = 8) => {
  return `Balance of [${address}] = ${utils.formatUnits(balance.toString(), decimals)} $KOMBAT`
}

export const tokenToWei = (value: number, decimals = 18) => {
  return utils.parseUnits(value.toString(), decimals).toString()
}

export const tokenToBignumberWithDecimals = (value: number, decimals = 18) => {
  return utils.parseUnits(value.toString(), decimals)
}

export const getEvent = (receipt: ContractReceipt, contractAddress: string, eventName: string): Event | undefined => {
  return receipt.events?.find((e) => e.address == contractAddress && e.event == eventName)
}
