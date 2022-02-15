// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

import '@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol';

contract GravisTokenX is ERC20PresetMinterPauser {
    constructor() public ERC20PresetMinterPauser('Gravis Finance Token X', 'GRVX') {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override(ERC20PresetMinterPauser) {
        super._beforeTokenTransfer(from, to, amount);
    }
}
