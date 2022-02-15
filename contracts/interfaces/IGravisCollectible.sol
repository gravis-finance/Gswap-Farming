// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.12;

interface IGravisCollectible {
    function transferFor(
        address _from,
        address _to,
        uint256 _type,
        uint256 _amount
    ) external;

    function mint(
        address _to,
        uint256 _type,
        uint256 _amount
    ) external returns (uint256);

    function mintFor(
        address[] memory _to,
        uint256[] memory _amount,
        uint256 _type
    ) external;

    function burnFor(
        address _who,
        uint256 _type,
        uint256 _amount
    ) external;
}
