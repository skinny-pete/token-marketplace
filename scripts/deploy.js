const { ethers } = require('hardhat');

async function main() {
  const feeNum = 3;
  const feeDenom = 100;
  const treasury = '0x8c7633c0C6134288b136F248C9C9f912e57Fe893';

  const marketplaceFactory = await ethers.getContractFactory('ChangeblockMarketplace');
  const marketplace = await marketplaceFactory.deploy(feeNum, feeDenom, treasury);

  await marketplace.deployed();
  console.log('Deployed to: ', marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
