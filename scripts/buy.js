const { ethers } = require('hardhat');

async function main() {
  const [signer] = await ethers.getSigners();

  const listingId = '92724642998020262069236578207325784498738487041384867832332472935861553035550';
  const marketabi = [
    'function approveSeller(address buyer, bool approval) public',
    'function listERC20(uint256 amount, uint256 price, address product, address currency) public',
    'function updateERC20Price(uint listingId, uint price) external',
    'function buyERC20(uint listingId, uint amount, uint price) public view',
    'function ERC20Listings(uint listingId) public view returns (ERC20Listing)',
  ];
  const marketAddress = '0xe1dBC97bA0AbeF332EA82D2f41045e578033eEdd';

  const currency = '0x2bb43CC67360b1a4842425Bc6224E9886778525B';
  const erc20abi = [
    'function approve(address spender, uint amount) public',
    'function increaseAllowance(address spender, uint amount) public',
    'function allowance(address owner, address spender) public view returns (uint)',
  ];

  const amount = ethers.utils.parseEther('0.01');

  const currencyToken = new ethers.Contract(currency, erc20abi, signer);

  const tx = await currencyToken.increaseAllowance(
    marketAddress,
    ethers.utils.parseEther('1000000000000')
  );
  await tx.wait();
  //   console.log('allowance: ', await currencyToken.allowance(signer.address, marketAddress));

  //   const price = ethers.utils.parseEther('3');
  const price = '1000000000000000000';
  console.log('approved');
  const marketplace = new ethers.Contract(marketAddress, marketabi, signer);

  //   console.log('token: ', await marketplace.ERC20Listings(listingId));
  await marketplace.buyERC20(listingId, amount, price);

  console.log('bought');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
