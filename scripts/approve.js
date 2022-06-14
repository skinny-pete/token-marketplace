const { ethers } = require("hardhat");

async function main() {
  const toApprove = "0x56CB68BbF27E8e6cb85D8b454a3e4Fb5FaE2588f";

  const abi = ["function approveSeller(address buyer, bool approval) public"];
  const marketAddress = "0x8773718B0bD94BD0590cb2Ef6d83CbE801e70daC";

  const [signer] = await ethers.getSigners();
  const marketplace = new ethers.Contract(marketAddress, abi, signer);

  const tx = await marketplace.approveSeller(toApprove, true);
  await tx.wait();
  console.log("approved");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
