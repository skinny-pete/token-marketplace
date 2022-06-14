const { ethers } = require("hardhat");

async function main() {
  const feeNum = 3;
  const feeDenom = 100;
  const treasury = "0x56CB68BbF27E8e6cb85D8b454a3e4Fb5FaE2588f";

  const marketplaceFactory = await ethers.getContractFactory(
    "ChangeblockMarketplace"
  );
  const marketplace = await marketplaceFactory.deploy(
    feeNum,
    feeDenom,
    treasury
  );

  await marketplace.deployed();
  console.log("Deployed to: ", marketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
