const { ethers } = require('hardhat');

async function main() {
  const toApprove = '0x56CB68BbF27E8e6cb85D8b454a3e4Fb5FaE2588f';

  const listingId = '25871543060584433467909079409806940929808318787246287840312141991726095572922';
  const marketabi = [
    'function approveSeller(address buyer, bool approval) public',
    'function listERC20(uint256 amount, uint256 price, address product, address currency) public',
    'function updateERC20Price(uint listingId, uint price) external',
  ];
  const marketAddress = '0xe1dBC97bA0AbeF332EA82D2f41045e578033eEdd';

  const [signer] = await ethers.getSigners();
  const marketplace = new ethers.Contract(marketAddress, marketabi, signer);
  const newPrice = ethers.utils.parseEther('3');
  await marketplace.updateERC20Price(listingId, newPrice);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
