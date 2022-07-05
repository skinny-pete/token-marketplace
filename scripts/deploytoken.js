const { ethers } = require('hardhat');

async function main() {
  const mintTo = '0x56CB68BbF27E8e6cb85D8b454a3e4Fb5FaE2588f';
  const signer = await ethers.getSigner();
  const tokenFactory = await ethers.getContractFactory('MintableERC20');
  const token = await tokenFactory.deploy('CBTProd', 'CBTP');
  console.log('Deployed to:', token.address);
  await token.mint(mintTo, ethers.utils.parseEther('1000'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
