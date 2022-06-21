const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  getERC20ListingId,
  getERC721ListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
  setupERC20Listing,
  setupERC721Listing,
} = require('../utils.js');

describe('Listing', () => {
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
    // Testing constants
    const amount = ethers.utils.parseEther('250');
    const ecoTokenPrice = ethers.BigNumber.from('2');

    beforeEach(async () => {
      ecoToken = await mintableERC20Factory.deploy('Eco Token', 'ET');
    });

    it('Listings struct created with correct parameters', async () => {
      const listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(amount);
      expect(await ecoToken.balanceOf(deployer.address)).to.equal(0);
      expect(ERC20Listing.amount).to.equal(amount);
      expect(ERC20Listing.price).to.equal(ecoTokenPrice);
      expect(ERC20Listing.vendor).to.equal(deployer.address);
      expect(ERC20Listing.product).to.equal(ecoToken.address);
      expect(ERC20Listing.currency).to.equal(stableCoin.address);
    });

    // Update with new event
    it('Emits ERC20Registration event', async () => {
      await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
      await marketplace.setSellers([deployer.address], [true]);
      const listingId = getERC20ListingId(deployer, ecoToken, stableCoin);
      await expect(
        marketplace.listERC20(amount, ecoTokenPrice, ecoToken.address, stableCoin.address)
      )
        .to.emit(marketplace, 'ERC20Registration')
        .withArgs(
          amount,
          ecoTokenPrice,
          deployer.address,
          ecoToken.address,
          stableCoin.address,
          listingId
        );
    });

    it('Cannot list without seller approval', async () => {
      await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
      await expect(
        marketplace.listERC20(amount, ecoTokenPrice, ecoToken.address, stableCoin.address)
      ).to.be.revertedWith('Approved sellers only');
    });

    it('Cannot list without ERC20 approval', async () => {
      await ecoToken.mint(deployer.address, amount);
      await marketplace.setSellers([deployer.address], [true]);
      await expect(
        marketplace.listERC20(amount, ecoTokenPrice, ecoToken.address, stableCoin.address)
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });

    it('Consecutive listings updates amount and price', async () => {
      const listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      // Call explicitly.
      await ecoToken.mint(deployer.address, amount);
      await ecoToken.approve(marketplace.address, amount);
      const newEcoTokenPrice = ethers.BigNumber.from('5');
      await expect(
        marketplace.listERC20(amount, newEcoTokenPrice, ecoToken.address, stableCoin.address)
      )
        .to.emit(marketplace, 'ERC20Registration')
        .withArgs(
          amount,
          newEcoTokenPrice,
          deployer.address,
          ecoToken.address,
          stableCoin.address,
          listingId
        );
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(amount.mul(2));
      expect(await ecoToken.balanceOf(deployer.address)).to.equal(0);
      expect(ERC20Listing.amount).to.equal(amount.mul(2));
      expect(ERC20Listing.price).to.equal(newEcoTokenPrice);
      expect(ERC20Listing.vendor).to.equal(deployer.address);
      expect(ERC20Listing.product).to.equal(ecoToken.address);
      expect(ERC20Listing.currency).to.equal(stableCoin.address);
    });

    it('Lister delists some tokens', async () => {
      const listingId = await setupERC20Listing(
        notDeployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      const delistedAmount = amount.div(4);
      await marketplace.connect(notDeployer).delistERC20(listingId, delistedAmount);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(amount.sub(delistedAmount));
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(delistedAmount);
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(ERC20Listing.amount).to.equal(amount.sub(delistedAmount));
    });

    it('Owner delists some tokens', async () => {
      const listingId = await setupERC20Listing(
        notDeployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      const delistedAmount = amount.div(3);
      await marketplace.delistERC20(listingId, delistedAmount);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(amount.sub(delistedAmount));
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(delistedAmount);
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(ERC20Listing.amount).to.equal(amount.sub(delistedAmount));
    });

    it('Rejects delist of excess tokens', async () => {
      const listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      await expect(marketplace.delistERC20(amount.mul(2), listingId)).to.be.revertedWith(
        'Insufficient tokens listed'
      );
    });

    it('Rejects delist from non-lister/non-owner account', async () => {
      const listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      await expect(
        marketplace.connect(notDeployer).delistERC20(amount, listingId)
      ).to.be.revertedWith('Only vendor or marketplace owner can delist');
    });

    it('Vendor can update listing price', async () => {
      const listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      const newEcoTokenPrice = ethers.BigNumber.from('5');
      await marketplace.updateERC20Price(listingId, newEcoTokenPrice);
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(ERC20Listing.price).to.equal(newEcoTokenPrice);
    });

    it('Rejects non-vendor listing price update', async () => {
      const listingId = await setupERC20Listing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      await expect(
        marketplace.connect(notDeployer).updateERC20Price(listingId, ethers.BigNumber.from('5'))
      ).to.be.revertedWith('Only vendor can update price');
    });
  });

  describe('ERC721s', () => {
    const ecoNFTId = ethers.BigNumber.from('0');
    const ecoNFTPrice = ethers.utils.parseEther('250');

    beforeEach(async () => {
      stableCoin = await mintableERC20Factory.deploy('Stable Coin', 'SC');
      ecoNFT = await mintableERC721Factory.deploy('Eco NFT', 'ENFT');
    });

    it('Correct post listing state', async () => {
      const listingId = await setupERC721Listing(
        deployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        ecoNFTPrice,
        stableCoin
      );
      const ERC721Listing = await marketplace.ERC721Listings(listingId);
      expect(await ecoNFT.ownerOf(ecoNFTId)).to.equal(marketplace.address);
      expect(ERC721Listing.id).to.equal(ecoNFTId);
      expect(ERC721Listing.price).to.equal(ecoNFTPrice);
      expect(ERC721Listing.vendor).to.equal(deployer.address);
      expect(ERC721Listing.product).to.equal(ecoNFT.address);
      expect(ERC721Listing.currency).to.equal(stableCoin.address);
    });

    it('Emits ERC721Registration event', async () => {
      await mintAndApproveERC721(ecoNFT, ecoNFTId, deployer, marketplace);
      await marketplace.setSellers([deployer.address], [true]);
      const listingId = getERC721ListingId(ecoNFTId, ecoNFT);
      // UPDATE WITH LATEST EVENT
      await expect(
        marketplace.listERC721(ecoNFTId, ecoNFTPrice, ecoNFT.address, stableCoin.address)
      )
        .to.emit(marketplace, 'ERC721Registration')
        .withArgs(
          ecoNFTId,
          ecoNFTPrice,
          deployer.address,
          ecoNFT.address,
          stableCoin.address,
          listingId
        );
    });

    it('Cannot list without seller approval', async () => {
      await mintAndApproveERC721(ecoNFT, ecoNFTId, deployer, marketplace);
      await expect(
        marketplace.listERC721(ecoNFTId, ecoNFTPrice, ecoNFT.address, stableCoin.address)
      ).to.be.revertedWith('Approved sellers only');
    });

    it('Cannot list without ERC721 approval', async () => {
      await ecoNFT.mint(deployer.address);
      await marketplace.setSellers([deployer.address], [true]);
      await expect(
        marketplace.listERC721(ecoNFTId, ecoNFTPrice, ecoNFT.address, stableCoin.address)
      ).to.be.revertedWith('ERC721: transfer caller is not owner nor approved');
    });

    // Add events
    it('Lister delists', async () => {
      const listingId = await setupERC721Listing(
        notDeployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        ecoNFTPrice,
        stableCoin
      );
      await marketplace.connect(notDeployer).delistERC721(listingId);
      expect(await ecoNFT.ownerOf(ecoNFTId)).to.equal(notDeployer.address);
    });

    // Add events
    it('Owner delists', async () => {
      const listingId = await setupERC721Listing(
        notDeployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        ecoNFTPrice,
        stableCoin
      );
      await marketplace.delistERC721(listingId);
      expect(await ecoNFT.ownerOf(ecoNFTId)).to.equal(notDeployer.address);
    });

    // Add events
    it('Rejects delist from non-lister/non owner', async () => {
      const listingId = await setupERC721Listing(
        deployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        ecoNFTPrice,
        stableCoin
      );
      await expect(marketplace.connect(notDeployer).delistERC721(listingId)).to.be.revertedWith(
        'Only vendor or marketplace owner can delist'
      );
    });

    it('Vendor can update listing price', async () => {
      const listingId = await setupERC721Listing(
        deployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        ecoNFTPrice,
        stableCoin
      );
      const newEcoNFTPrice = ethers.BigNumber.from('100');
      await marketplace.updateERC721Price(listingId, newEcoNFTPrice);
      const ERC721Listing = await marketplace.ERC721Listings(listingId);
      expect(ERC721Listing.price).to.equal(newEcoNFTPrice);
    });

    it('Rejects non-vendor listing price update', async () => {
      const listingId = await setupERC721Listing(
        deployer,
        marketplace,
        ecoNFTId,
        ecoNFT,
        ecoNFTPrice,
        stableCoin
      );
      await expect(
        marketplace.connect(notDeployer).updateERC721Price(listingId, ethers.BigNumber.from('100'))
      ).to.be.revertedWith('Only vendor can update price');
    });
  });
});
