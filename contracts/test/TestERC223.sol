// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import './TestERC20.sol';

contract TestERC223 is TestERC20 {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 amount_
    ) public TestERC20(name_, symbol_, amount_) {}

    function transferAndCall(
        address to,
        uint256 value,
        bytes calldata
    ) public returns (bool) {
        return transfer(to, value);
    }
}
