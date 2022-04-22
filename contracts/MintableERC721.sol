//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// Used for testing/demos

contract MintableERC721 is ERC721 {
    uint256 nextTokenId;

    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
    {}

    function mint(address to) public {
        _mint(to, nextTokenId);
        nextTokenId++;
    }
}
