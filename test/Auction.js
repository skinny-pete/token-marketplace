// const { expect } = require('chai');
// const { ethers } = require('hardhat');
// const {
//   getListingId,
//   mintAndApproveERC20,
//   mintAndApproveERC721,
// } = require('../utils.js');

// describe('ChangeblockMarketplace', function () {
//   let deployer, buyer, treasury; // Signers
//   let marketplaceFactory, mintableERC20Factory, mintableERC721Factory; // Contract factories
//   let stableCoin, ecoToken, ecoNFT; // Token contracts
//   let marketplace; // Marketplace contract

//   before(async () => {
//     [deployer, buyer, treasury] = await ethers.getSigners();
//     marketplaceFactory = await ethers.getContractFactory(
//       'ChangeblockMarketplace'
//     );
//     mintableERC20Factory = await ethers.getContractFactory('MintableERC20');
//     mintableERC721Factory = await ethers.getContractFactory('MintableERC721');
//   });

//   const feeNumerator = ethers.BigNumber.from('500000');
//   const feeDenominator = ethers.BigNumber.from('10000000');

//   beforeEach(async () => {
//     marketplace = await marketplaceFactory.deploy(
//       feeNumerator,
//       feeDenominator,
//       treasury.address
//     );
//     stableCoin = await mintableERC20Factory.deploy('Stable Coin', 'SC');
//     ecoToken = await mintableERC20Factory.deploy('Eco Token', 'ET');
//     ecoNFT = await mintableERC721Factory.deploy('Eco NFT', 'ENFT');
//   });

//   it('Set approval', async () => {
//     await marketplace.setSellers([buyer.address], [true]);
//     expect(await marketplace.sellerApprovals(buyer.address)).to.equal(true);
//   });

//   const amount = ethers.utils.parseEther('250');
//   const ecoTokenPrice = ethers.BigNumber.from('2');
// });

//   //   it('Allows bidding', async () => {
//   //     await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
//   //     await marketplace.setSellers([deployer.address], [true]);
//   //     await marketplace.listERC20(
//   //       amount,
//   //       ecoTokenPrice,
//   //       ecoToken.address,
//   //       stableCoin.address
//   //     );
//   //     const basePayment = ecoTokenPrice.mul(amount);
//   //     const fee = basePayment.mul(feeNumerator).div(feeDenominator);
//   //     await mintAndApproveERC20(
//   //       stableCoin,
//   //       basePayment.add(fee),
//   //       buyer,
//   //       marketplace
//   //     );
//   //     const listingId = getListingId(
//   //       amount,
//   //       ecoTokenPrice,
//   //       deployer,
//   //       ecoToken,
//   //       stableCoin
//   //     );
//   //     await marketplace.setBuyers([buyer.address], [true]);

//   //     const bidPrice = ethers.utils.parseEther('10');
//   //     const bidQuantity = ethers.utils.parseEther('15');

//   //     const total = bidPrice.mul(bidQuantity);

//   //     await stableCoin.mint(buyer.address, total);

//   //     await stableCoin.connect(buyer).approve(marketplace.address, total);
//   //     await expect(() =>
//   //       marketplace.connect(buyer).bidERC20(listingId, bidQuantity, bidPrice)
//   //     ).to.changeTokenBalance(stableCoin, buyer, total.mul(-1));
//   //   });

//   //   it('Allows bid withdrawal', async () => {
//   //     await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
//   //     await marketplace.setSellers([deployer.address], [true]);
//   //     await marketplace.listERC20(
//   //       amount,
//   //       ecoTokenPrice,
//   //       ecoToken.address,
//   //       stableCoin.address
//   //     );
//   //     const basePayment = ecoTokenPrice.mul(amount);
//   //     const fee = basePayment.mul(feeNumerator).div(feeDenominator);
//   //     await mintAndApproveERC20(
//   //       stableCoin,
//   //       basePayment.add(fee),
//   //       buyer,
//   //       marketplace
//   //     );
//   //     const listingId = getListingId(
//   //       amount,
//   //       ecoTokenPrice,
//   //       deployer,
//   //       ecoToken,
//   //       stableCoin
//   //     );
//   //     await marketplace.setBuyers([buyer.address], [true]);

//   //     const bidPrice = ethers.utils.parseEther('10');
//   //     const bidQuantity = ethers.utils.parseEther('15');

//   //     const total = bidPrice.mul(bidQuantity);

//   //     await stableCoin.mint(buyer.address, total);

//   //     await stableCoin.connect(buyer).approve(marketplace.address, total);

//   //     await marketplace.connect(buyer).bidERC20(listingId, bidQuantity, bidPrice);

//   //     await network.provider.send('evm_mine');

//   //     const balanceBefore = await stableCoin.balanceOf(buyer.address);

//   //     await marketplace.connect(buyer).withdrawBid(listingId);

//   //     const balanceAfter = await stableCoin.balanceOf(buyer.address);

//   //     expect(balanceAfter).to.equal(balanceBefore.add(total));
//   //   });

//   //   it('Allows bid acceptance', async () => {
//   //     await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
//   //     await marketplace.setSellers([deployer.address], [true]);
//   //     await marketplace.listERC20(
//   //       amount,
//   //       ecoTokenPrice,
//   //       ecoToken.address,
//   //       stableCoin.address
//   //     );
//   //     const basePayment = ecoTokenPrice.mul(amount);
//   //     const fee = basePayment.mul(feeNumerator).div(feeDenominator);
//   //     await mintAndApproveERC20(
//   //       stableCoin,
//   //       basePayment.add(fee),
//   //       buyer,
//   //       marketplace
//   //     );
//   //     const listingId = getListingId(
//   //       amount,
//   //       ecoTokenPrice,
//   //       deployer,
//   //       ecoToken,
//   //       stableCoin
//   //     );
//   //     await marketplace.setBuyers([buyer.address], [true]);

//   //     const bidPrice = ethers.utils.parseEther('10');
//   //     const bidQuantity = ethers.utils.parseEther('15');

//   //     const total = bidPrice.mul(bidQuantity);

//   //     await stableCoin.mint(buyer.address, total);

//   //     await stableCoin.connect(buyer).approve(marketplace.address, total);

//   //     await marketplace.connect(buyer).bidERC20(listingId, bidQuantity, bidPrice);

//   //     const listerBefore = await stableCoin.balanceOf(deployer.address);
//   //     const buyerBefore = await stableCoin.balanceOf(buyer.address);

//   //     await marketplace.connect(deployer).respondBid(listingId, 0, true);
//   //     await network.provider.send('evm_mine');

//   //     const listerAfter = await stableCoin.balanceOf(deployer.address);
//   //     const buyerAfter = await stableCoin.balanceOf(buyer.address);

//   //     const fee2 = total.mul(feeNumerator).div(feeDenominator);
//   //     expect(listerAfter).to.equal(listerBefore.add(total).sub(fee2));
//   //     expect(buyerAfter).to.equal(buyerBefore);
//   //     expect(await stableCoin.balanceOf(treasury.address)).to.equal(fee2);
//   //   });

//   //   it('Allows bid rejection', async () => {
//   //     await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
//   //     await marketplace.setSellers([deployer.address], [true]);
//   //     await marketplace.listERC20(
//   //       amount,
//   //       ecoTokenPrice,
//   //       ecoToken.address,
//   //       stableCoin.address
//   //     );
//   //     const basePayment = ecoTokenPrice.mul(amount);
//   //     const fee = basePayment.mul(feeNumerator).div(feeDenominator);
//   //     await mintAndApproveERC20(
//   //       stableCoin,
//   //       basePayment.add(fee),
//   //       buyer,
//   //       marketplace
//   //     );
//   //     const listingId = getListingId(
//   //       amount,
//   //       ecoTokenPrice,
//   //       deployer,
//   //       ecoToken,
//   //       stableCoin
//   //     );
//   //     await marketplace.setBuyers([buyer.address], [true]);

//   //     const bidPrice = ethers.utils.parseEther('10');
//   //     const bidQuantity = ethers.utils.parseEther('15');

//   //     const total = bidPrice.mul(bidQuantity);

//   //     await stableCoin.mint(buyer.address, total);

//   //     await stableCoin.connect(buyer).approve(marketplace.address, total);

//   //     await marketplace.connect(buyer).bidERC20(listingId, bidQuantity, bidPrice);

//   //     const listerBefore = await stableCoin.balanceOf(deployer.address);
//   //     const buyerBefore = await stableCoin.balanceOf(buyer.address);

//   //     await marketplace.connect(deployer).respondBid(listingId, 0, false);
//   //     await network.provider.send('evm_mine');

//   //     const listerAfter = await stableCoin.balanceOf(deployer.address);
//   //     const buyerAfter = await stableCoin.balanceOf(buyer.address);

//   //     const fee2 = total.mul(feeNumerator).div(feeDenominator);
//   //     expect(listerAfter).to.equal(listerBefore);
//   //     expect(buyerAfter).to.equal(buyerBefore.add(total));
//   //     expect(await stableCoin.balanceOf(treasury.address)).to.equal(0);
//   //   });
// });

// // npx hardhat test test/ChangeblockMarketplace.js
