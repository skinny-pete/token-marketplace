const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  getERC20ListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
  setupListing,
} = require('../utils.js');

describe('Listing', () => {
  let deployer, notDeployer, treasury; // Signers
  let marketplaceFactory, mintableERC20Factory, mintableERC721Factory; // Contract factories
  let stableCoin, ecoToken, ecoNFT; // Token contracts
  let marketplace; // Marketplace contract

  before(async () => {
    [deployer, notDeployer, treasury] = await ethers.getSigners();
    marketplaceFactory = await ethers.getContractFactory(
      'ChangeblockMarketplace'
    );
    mintableERC20Factory = await ethers.getContractFactory('MintableERC20');
    mintableERC721Factory = await ethers.getContractFactory('MintableERC721');
  });

  const feeNumerator = ethers.BigNumber.from('500000');
  const feeDenominator = ethers.BigNumber.from('10000000');

  beforeEach(async () => {
    marketplace = await marketplaceFactory.deploy(
      feeNumerator,
      feeDenominator,
      treasury.address
    );
    stableCoin = await mintableERC20Factory.deploy('Stable Coin', 'SC');
    ecoNFT = await mintableERC721Factory.deploy('Eco NFT', 'ENFT');
  });

  // multiple listings add to the same listing - CHECK

  describe('ERC20s', () => {
    // Testing constants
    const amount = ethers.utils.parseEther('250');
    const ecoTokenPrice = ethers.BigNumber.from('2');

    beforeEach(async () => {
      ecoToken = await mintableERC20Factory.deploy('Eco Token', 'ET');
    });

    it('Correct post listing state', async () => {
      const listingId = await setupListing(
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

    it('Emits `ERC20Registration` event', async () => {
      await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
      await marketplace.setSellers([deployer.address], [true]);
      const listingId = getERC20ListingId(
        ecoTokenPrice,
        deployer,
        ecoToken,
        stableCoin
      );
      await expect(
        marketplace.listERC20(
          amount,
          ecoTokenPrice,
          ecoToken.address,
          stableCoin.address
        )
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
        marketplace.listERC20(
          amount,
          ecoTokenPrice,
          ecoToken.address,
          stableCoin.address
        )
      ).to.be.revertedWith('Approved sellers only');
    });

    it('Cannot list without ERC20 approval', async () => {
      await ecoToken.mint(deployer.address, amount);
      await marketplace.setSellers([deployer.address], [true]);
      await expect(
        marketplace.listERC20(
          amount,
          ecoTokenPrice,
          ecoToken.address,
          stableCoin.address
        )
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });

    // // Mint and approve an amount of ERC20 tokens
    // const mintAndApproveERC20 = async (ERC20, amount, approver, approved) => {
    //   return ERC20.mint(approver.address, amount).then(() => {
    //     ERC20.connect(approver).approve(approved.address, amount);
    //   });
    // };

    it('Multiple listings of the same token and price', async () => {
      const listingId = await setupListing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
      // await ecoToken.mint(deployer.address, amount);
      // await ecoToken.approve(marketplace.address, amount);
      await marketplace.listERC20(
        amount,
        ecoTokenPrice,
        ecoToken.address,
        stableCoin.address
      );

      //   .to.emit(marketplace, 'ERC20Registration')
      //   .withArgs(
      //     amount,
      //     ecoTokenPrice,
      //     deployer.address,
      //     ecoToken.address,
      //     stableCoin.address,
      //     listingId
      //   );
      // const ERC20Listing = await marketplace.ERC20Listings(listingId);
      // expect(await ecoToken.balanceOf(marketplace.address)).to.equal(amount);
      // expect(await ecoToken.balanceOf(deployer.address)).to.equal(0);
      // expect(ERC20Listing.amount).to.equal(amount);
      // expect(ERC20Listing.price).to.equal(ecoTokenPrice);
      // expect(ERC20Listing.vendor).to.equal(deployer.address);
      // expect(ERC20Listing.product).to.equal(ecoToken.address);
      // expect(ERC20Listing.currency).to.equal(stableCoin.address);
    });

    it('Lister delists tokens', async () => {
      const listingId = await setupListing(
        notDeployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      const delistedAmount = amount.div(4);
      await expect(
        marketplace.connect(notDeployer).delistERC20(delistedAmount, listingId)
      )
        .to.emit(marketplace, 'Removal')
        .withArgs(listingId);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(
        amount.sub(delistedAmount)
      );
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(
        delistedAmount
      );
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(ERC20Listing.amount).to.equal(amount.sub(delistedAmount));
    });

    it('Owner delists tokens', async () => {
      const listingId = await setupListing(
        notDeployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      const delistedAmount = amount.div(3);
      await expect(marketplace.delistERC20(delistedAmount, listingId))
        .to.emit(marketplace, 'Removal')
        .withArgs(listingId);
      expect(await ecoToken.balanceOf(marketplace.address)).to.equal(
        amount.sub(delistedAmount)
      );
      expect(await ecoToken.balanceOf(notDeployer.address)).to.equal(
        delistedAmount
      );
      const ERC20Listing = await marketplace.ERC20Listings(listingId);
      expect(ERC20Listing.amount).to.equal(amount.sub(delistedAmount));
    });

    it('Rejects delist of excess tokens', async () => {
      const listingId = await setupListing(
        deployer,
        marketplace,
        ecoToken,
        amount,
        ecoTokenPrice,
        stableCoin
      );
      await expect(
        marketplace.delistERC20(amount.mul(2), listingId)
      ).to.be.revertedWith('Insufficient tokens listed');
    });

    it('Rejects delist from non-lister/non-owner account', async () => {
      const listingId = await setupListing(
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
  });

  // describe('ERC721s', () => {
  //   const ecoNFTId = ethers.BigNumber.from('0');
  //   const ecoNFTPrice = ethers.utils.parseEther('250');

  //   beforeEach(async () => {
  //     stableCoin = await mintableERC20Factory.deploy('Stable Coin', 'SC');
  //     ecoNFT = await mintableERC721Factory.deploy('Eco NFT', 'ENFT');
  //   });
  // });
});
