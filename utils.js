// ------------------- CHANGEBLOCK MARKETPLACE UTILS -------------------

// For use in tests and scripts

// Get ID for either an ERC20 listing
const getERC20ListingId = (price, seller, sellToken, buyToken) => {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['uint256', 'address', 'address', 'address'],
      [price, seller.address, sellToken.address, buyToken.address]
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

// Mint, approve, then list some tokens
const setupListing = async (
  lister,
  marketplace,
  token,
  amount,
  price,
  currency
) => {
  await mintAndApproveERC20(token, amount, lister, marketplace);
  await marketplace.setSellers([lister.address], [true]);
  await marketplace
    .connect(lister)
    .listERC20(amount, price, token.address, currency.address);
  return ethers.BigNumber.from(
    getERC20ListingId(price, lister, token, currency)
  );
};

module.exports = {
  getERC20ListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
  getFee,
  setupListing,
};
