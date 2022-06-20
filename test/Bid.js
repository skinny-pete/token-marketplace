const { expect } = require('chai');
const { ethers } = require('hardhat');
// const { helpers } = require('@nomicfoundation/hardhat-network-helpers');
const {
  getERC20ListingId,
  getERC721ListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
  setupERC20Listing,
  setupERC721Listing,
} = require('../utils.js');

describe('Bidding', () => {
  let deployer, notDeployer, treasury; // Signers
  let marketplaceFactory, mintableERC20Factory, mintableERC721Factory; // Contract factories
  let currency, product; // Token contracts
  let marketplace; // Marketplace contract

  before(async () => {
    [deployer, notDeployer, treasury] = await ethers.getSigners();
    marketplaceFactory = await ethers.getContractFactory('ChangeblockMarketplace');
    mintableERC20Factory = await ethers.getContractFactory('MintableERC20');
  });

  let listingId; // ID of beforeEach lisiting

  const price = ethers.BigNumber.from('2');
  const amount = ethers.utils.parseEther('100');
  const balance = ethers.utils.parseEther('1000');

  beforeEach(async () => {
    marketplace = await marketplaceFactory.deploy(
      ethers.BigNumber.from('500000'),
      ethers.BigNumber.from('10000000'),
      treasury.address
    );
    currency = await mintableERC20Factory.deploy('Stable Coin', 'SC');
    product = await mintableERC20Factory.deploy('Eco Token', 'ET');
    listingId = await setupERC20Listing(deployer, marketplace, product, amount, price, currency);
    await mintAndApproveERC20(currency, balance, notDeployer, marketplace);
    await marketplace.setBuyers([notDeployer.address], [true]);
  });

  const quantity = ethers.utils.parseEther('10');
  const payment = ethers.utils.parseEther('15');

  it('Registers a bid', async () => {
    // await expect(marketplace.connect(notDeployer).bid(listingId, quantity, payment))
    //   .to.emit(marketplace, 'BidPlaced')
    //   // .withArgs(listingId, quantity, payment, notDeployer.address);
    // const bid = await marketplace.bids(listingId, notDeployer.address);
    // expect(bid.quantity).to.equal(quantity);
    // expect(bid.payment).to.equal(payment);
    // expect(await marketplace.bidders(listingId, 0)).to.equal(notDeployer.address);
    // expect(await currency.balanceOf(notDeployer.address)).to.equal(balance.sub(payment));
    // expect(await currency.balanceOf(marketplace.address)).to.equal(payment);
  });

  it('Accept a bid', async () => {
    await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
  });
});

// npx hardhat test test/Bid.js
