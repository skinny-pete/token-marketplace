const { ethers } = require("hardhat");

async function main() {
  const toApprove = "0x56CB68BbF27E8e6cb85D8b454a3e4Fb5FaE2588f";

  const marketabi = [
    "function approveSeller(address buyer, bool approval) public",
    "function listERC20(uint256 amount, uint256 price, address product, address currency) public",
  ];
  const marketAddress = "0x8773718B0bD94BD0590cb2Ef6d83CbE801e70daC";

  const [signer] = await ethers.getSigners();
  const marketplace = new ethers.Contract(marketAddress, marketabi, signer);

  const amount = 10000000;
  const price = 1000;
  const product = "0xB74873084d944B9eEB3af292FEB01502bdFDDBf1";
  const currency = "0xB74873084d944B9eEB3af292FEB01502bdFDDBf1";

  //   const overrides = { gasPrice: 3000000000, gasLimit: 300000 };

  const erc20abi = ["function approve(address spender, uint amount) public"];
  const stableAddress = "0x3bfE7886A6bfDd017F3aB1707843F01D2A13E657";

  const productAddress = "0x57121Fd118547E63dB75f03eA470CCb7bd8Dc119";
  const productContract = new ethers.Contract(product, erc20abi, signer);

  console.log("approving");

  let producttx = await productContract.approve(marketAddress, amount);
  await producttx.wait();

  console.log("listing");

  const tx = await marketplace.listERC20(amount, price, product, currency);
  await tx.wait();
  console.log("listed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
