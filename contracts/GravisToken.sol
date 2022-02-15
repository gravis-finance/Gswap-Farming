// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import '@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20Capped.sol';

contract GravisToken is ERC20PresetMinterPauser, ERC20Capped {
    constructor() public ERC20PresetMinterPauser('Gravis Finance Token', 'GRVS') ERC20Capped(150000000e18) {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20PresetMinterPauser, ERC20Capped) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
