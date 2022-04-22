// ------------------- CHANGEBLOCK UTILS -------------------

// For use in tests and scripts

// Get ID for either an ERC20 or ERC721 listing
const getListingId = (amountOrId, price, seller, sellToken, buyToken) => {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256", "address", "address", "address"],
      [amountOrId, price, seller.address, sellToken.address, buyToken.address]
    )
  );
};

// Mint and approve an amount of ERC20 tokens
const mintAndApproveERC20 = async (ERC20, amount, approver, approved) => {
  return ERC20.mint(approver.address, amount).then(() => {
    ERC20.connect(approver).approve(approved.address, amount);
  });
};

// Mint and approve an ERC721 token
const mintAndApproveERC721 = async (ERC721, id, approver, approved) => {
  return ERC721.mint(approver.address).then(() => {
    ERC721.connect(approver).approve(approved.address, id);
  });
};

// Calculate fee for input amount and fee parameters
const getFee = (amount, feeNumerator, feeDenominator) => {
  return amount.mul(feeNumerator).div(feeDenominator);
};

module.exports = {
  getListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
  getFee,
};
