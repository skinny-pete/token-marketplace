const { ethers } = require('hardhat');

async function main() {
  // Tokens
  const tokenFactory = await ethers.getContractFactory('MintableERC20');
  const currency = await tokenFactory.deploy('Currency', 'CRY');
  const product = await tokenFactory.deploy('Product', 'PRDT');
  const deployer = await ethers.getSigner();
  await currency.mint(deployer.address, ethers.utils.parseEther('100'));
  await product.mint(deployer.address, ethers.utils.parseEther('100'));
  console.log('Currency: ', currency.address);
  console.log('Product: ', product.address);

  // Marketplace
  const marketplaceFactory = await ethers.getContractFactory('ChangeblockMarketplace');
  const marketplace = await marketplaceFactory.deploy(
    5,
    100,
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
  );
  console.log('Marketplace: ', marketplace.address);

  // Approve seller
  let txss = await marketplace.setSellers([deployer.address], [true]);
  await txss.wait();

  const listedAmount = ethers.utils.parseEther('10');
  const price = ethers.utils.parseEther('0.5');
  const listingId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'address'],
      [deployer.address, product.address, currency.address]
    )
  );

  console.log('Listing ID: ', listingId);

  let listing = await marketplace.getListing(listingId);
  console.log('Listing Zero: ');
  console.log(listing);

  // List
  let txapp = await product.approve(marketplace.address, listedAmount);
  await txapp.wait();

  // take a fee cut
  let txlist = await marketplace.listERC20(listedAmount, price, product.address, currency.address);
  await txlist.wait();

  listing = await marketplace.getListing(listingId);
  console.log('Listing: ');
  console.log(listing);

  // Approve
  let txall = await currency.increaseAllowance(marketplace.address, listedAmount.mul(price));
  await txall.wait();

  // Buy
  let txbuy = await marketplace.buyERC20(
    listingId,
    ethers.utils.parseEther('4'),
    ethers.utils.parseEther('0.5')
  );
  await txbuy.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// npx hardhat run scripts/setup.js
// npx hardhat run scripts/setup.js --network mumbai
