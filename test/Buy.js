const { expect } = require('chai');
const { providers } = require('ethers');
const { ethers } = require('hardhat');
const {
  getERC20ListingId,
  getERC721ListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
  setupERC20Listing,
  setupERC721Listing,
  getFee,
} = require('../utils.js');

describe('Buying', () => {
  let deployer, notDeployer, treasury; // Signers
  let marketplaceFactory, mintableERC20Factory, mintableERC721Factory; // Contract factories
  let stableCoin, ecoToken, ecoNFT; // Token contracts
  let marketplace; // Marketplace contract

  before(async () => {
    [deployer, notDeployer, treasury] = await ethers.getSigners();
    marketplaceFactory = await ethers.getContractFactory('ChangeblockMarketplace');
    mintableERC20Factory = await ethers.getContractFactory('MintableERC20');
    mintableERC721Factory = await ethers.getContractFactory('MintableERC721');
  });

  const feeNumerator = ethers.BigNumber.from('500000');
  const feeDenominator = ethers.BigNumber.from('10000000');

  beforeEach(async () => {
    marketplace = await marketplaceFactory.deploy(
      ethers.BigNumber.from('500000'),
      ethers.BigNumber.from('10000000'),
      treasury.address
    );
    stableCoin = await mintableERC20Factory.deploy('Stable Coin', 'SC');
    ecoNFT = await mintableERC721Factory.deploy('Eco NFT', 'ENFT');
  });

  describe('ERC20s', () => {
    let listingId; // ID for listing of ERC20s

    const listedAmount = ethers.utils.parseEther('250');
    const listingPrice = ethers.BigNumber.from('3');

    beforeEach(async () => {
      ecoToken = await mintableERC20Factory.deploy('Eco Token', 'ET');
      listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        listedAmount,
        listingPrice,
        stableCoin
      );
      await mintAndApproveERC20(
        stableCoin,
        ethers.utils.parseEther('10000'),
        notDeployer,
        marketplace
      );
      await marketplace.setBuyers([notDeployer.address], [true]);
    });

    const buyAmount = ethers.utils.parseEther('100');

    it('Correct post buy state', async () => {
      await marketplace.connect(notDeployer).buyERC20(listingId, buyAmount, listingPrice);
      expect(await stableCoin.balanceOf(deployer.address)).to.equal(buyAmount.mul(listingPrice));
      expect(await stableCoin.balanceOf(treasury.address)).to.equal(
        buyAmount.mul(listingPrice).mul(feeNumerator).div(feeDenominator)
      );
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(buyAmount);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(listedAmount.sub(buyAmount));
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(ERC20Listing.amount).to.equal(listedAmount.sub(buyAmount));
    });

    it('Emits ERC20Sale event ', async () => {
      await expect(marketplace.connect(notDeployer).buyERC20(listingId, buyAmount, listingPrice))
        .to.emit(marketplace, 'ERC20Sale')
        .withArgs(listingId, buyAmount, listingPrice, notDeployer.address);
    });

    it('Reverts if non-approved buyer', async () => {
      await marketplace.setBuyers([notDeployer.address], [false]);
      await marketplace.setBuyerWhitelisting(true);
      await expect(
        marketplace.connect(notDeployer).buyERC20(listingId, buyAmount, listingPrice)
      ).to.be.revertedWith('Approved buyers only');
    });

    it('Reverts for an attempt to buy excess tokens', async () => {
      await expect(
        marketplace.connect(notDeployer).buyERC20(listingId, listedAmount.mul(2), listingPrice)
      ).to.be.revertedWith('Insufficient listed tokens');
    });

    it('Reverts if non-current price passed as input', async () => {
      await expect(
        marketplace.connect(notDeployer).buyERC20(listingId, buyAmount, listingPrice.mul('2'))
      ).to.be.revertedWith('Listed price not equal to input price');
    });

    it('Deploys not using buyer whitelist', async () => {
      const toBuy = ethers.utils.parseEther('10');
      await expect(marketplace.connect(notDeployer).buyERC20(listingId, toBuy, listingPrice));
    });

    it('Allows multiple purchases from same listing', async () => {
      const firstPurchase = ethers.utils.parseEther('10');
      const secondPurchase = ethers.utils.parseEther('50');

      await marketplace.connect(notDeployer).buyERC20(listingId, firstPurchase, listingPrice);
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(firstPurchase);

      await marketplace.connect(notDeployer).buyERC20(listingId, secondPurchase, listingPrice);
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(
        firstPurchase.add(secondPurchase)
      );
    });

    it('Correct tokens purchased after price change', async () => {
      const firstPurchase = ethers.utils.parseEther('10');
      const secondPurchase = ethers.utils.parseEther('50');
      const newPrice = ethers.BigNumber.from('4');
      await marketplace.connect(notDeployer).buyERC20(listingId, firstPurchase, listingPrice);
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(firstPurchase);
      await marketplace.updateERC20Price(listingId, newPrice);
      const total = secondPurchase.mul(newPrice);
      const expectedPurchase = total.sub(total.mul(feeNumerator).div(feeDenominator));
      await expect(() =>
        marketplace.connect(notDeployer).buyERC20(listingId, secondPurchase, newPrice)
      ).to.changeTokenBalance(ecoToken, notDeployer, secondPurchase);
    });
  });

  describe('ERC721s', () => {
    let listingId; // ID for listed ERC721

    const ecoNFTId = ethers.BigNumber.from('0');
    const listingPrice = ethers.utils.parseEther('10');

    beforeEach(async () => {
      listingId = await setupERC721Listing(
        deployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        listingPrice,
        stableCoin
      );
      await mintAndApproveERC20(
        stableCoin,
        ethers.utils.parseEther('10000'),
        notDeployer,
        marketplace
      );
      await marketplace.setBuyers([notDeployer.address], [true]);
    });

    it('Correct post buy state', async () => {
      await marketplace.connect(notDeployer).buyERC721(listingId, listingPrice);
      expect(await stableCoin.balanceOf(deployer.address)).to.equal(listingPrice);
      expect(await stableCoin.balanceOf(treasury.address)).to.equal(
        listingPrice.mul(feeNumerator).div(feeDenominator)
      );
      expect(await ecoNFT.ownerOf(ecoNFTId)).to.equal(notDeployer.address);
    });

    it('Emits ERC721Sale event ', async () => {
      await expect(marketplace.connect(notDeployer).buyERC721(listingId, listingPrice))
        .to.emit(marketplace, 'ERC721Sale')
        .withArgs(listingId, listingPrice, notDeployer.address);
    });

    it('Reverts if non-current price passed as input', async () => {
      await expect(
        marketplace.connect(notDeployer).buyERC721(listingId, listingPrice.mul(2))
      ).to.be.revertedWith('Listed price not equal to input price');
    });

    it('Reverts if non-valid listing ID supplied', async () => {
      const fakeId = getERC721ListingId(ecoNFTId.add(1), ecoNFT); // wrong seller
      await expect(marketplace.connect(notDeployer).buyERC721(fakeId, listingPrice)).to.be.reverted;
    });
  });
});
