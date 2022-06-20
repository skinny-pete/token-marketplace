const { expect } = require('chai');
const { ethers } = require('hardhat');
const { mintAndApproveERC20, setupERC20Listing, getFee } = require('../utils.js');

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

  const feeNumerator = ethers.BigNumber.from('500000');
  const feeDenominator = ethers.BigNumber.from('10000000');

  beforeEach(async () => {
    marketplace = await marketplaceFactory.deploy(feeNumerator, feeDenominator, treasury.address);
    currency = await mintableERC20Factory.deploy('Stable Coin', 'SC');
    product = await mintableERC20Factory.deploy('Eco Token', 'ET');
    listingId = await setupERC20Listing(deployer, marketplace, product, amount, price, currency);
    await mintAndApproveERC20(currency, balance, notDeployer, marketplace);
    await marketplace.setBuyers([notDeployer.address], [true]);
  });

  const quantity = ethers.utils.parseEther('10');
  const payment = ethers.utils.parseEther('15');

  it('Registers a bid', async () => {
    await expect(marketplace.connect(notDeployer).bid(listingId, quantity, payment))
      .to.emit(marketplace, 'BidPlaced')
      .withArgs(listingId, quantity, payment, notDeployer.address, 0);
    const bid = await marketplace.bids(listingId, notDeployer.address, 0);
    expect(bid.quantity).to.equal(quantity);
    expect(bid.payment).to.equal(payment);
    expect(await currency.balanceOf(notDeployer.address)).to.equal(balance.sub(payment));
    expect(await currency.balanceOf(marketplace.address)).to.equal(payment);
  });

  it('Registers multiple bids', async () => {
    await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
    const secondQuantity = quantity.mul(2);
    const secondPayment = payment.mul(2);
    const thirdQuantity = quantity.mul(3);
    const thirdPayment = payment.div(2);
    await marketplace.connect(notDeployer).bid(listingId, secondQuantity, secondPayment);
    expect(await currency.balanceOf(marketplace.address)).to.equal(payment.add(secondPayment));
    await marketplace.connect(notDeployer).bid(listingId, thirdQuantity, thirdPayment);
    const secondBid = await marketplace.bids(listingId, notDeployer.address, 1);
    expect(secondBid.quantity).to.equal(secondQuantity);
    expect(secondBid.payment).to.equal(secondPayment);
    const thirdBid = await marketplace.bids(listingId, notDeployer.address, 2);
    expect(thirdBid.quantity).to.equal(thirdQuantity);
    expect(thirdBid.payment).to.equal(thirdPayment);
    expect(await currency.balanceOf(marketplace.address)).to.equal(
      payment.add(secondPayment).add(thirdPayment)
    );
  });

  it('Accept a single bidders bid', async () => {
    await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
    await expect(marketplace.acceptBid(listingId, notDeployer.address, 0, quantity, payment))
      .to.emit(marketplace, 'BidAccepted')
      .withArgs(listingId, notDeployer.address, quantity, payment);
    const fee = getFee(payment, feeNumerator, feeDenominator);
    expect(await currency.balanceOf(deployer.address)).to.equal(payment.sub(fee));
    expect(await currency.balanceOf(marketplace.address)).to.equal(0);
    expect(await currency.balanceOf(treasury.address)).to.equal(fee);
    expect(await product.balanceOf(marketplace.address)).to.equal(amount.sub(quantity));
    expect(await product.balanceOf(notDeployer.address)).to.equal(quantity);
    await expect(marketplace.bids(listingId, notDeployer.address, 0)).to.be.reverted;
  });

  it('Accept a bidders bid from multiple', async () => {
    await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
    await marketplace.connect(notDeployer).bid(listingId, quantity.mul(2), payment.mul(3));
    await marketplace.connect(notDeployer).bid(listingId, quantity.div(4), payment.mul(5));
    await marketplace.acceptBid(listingId, notDeployer.address, 1, quantity.mul(2), payment.mul(3));
    const firstBid = await marketplace.bids(listingId, notDeployer.address, 0);
    expect(firstBid.quantity).to.equal(quantity);
    expect(firstBid.payment).to.equal(payment);
    const secondBid = await marketplace.bids(listingId, notDeployer.address, 1);
    expect(secondBid.quantity).to.equal(quantity.div(4));
    expect(secondBid.payment).to.equal(payment.mul(5));
    await expect(marketplace.bids(listingId, notDeployer.address, 2)).to.be.reverted;
    const fee = getFee(payment.mul(3), feeNumerator, feeDenominator);
    expect(await currency.balanceOf(deployer.address)).to.equal(payment.mul(3).sub(fee));
    expect(await currency.balanceOf(marketplace.address)).to.equal(payment.mul(6));
    expect(await currency.balanceOf(treasury.address)).to.equal(fee);
    expect(await product.balanceOf(marketplace.address)).to.equal(amount.sub(quantity.mul(2)));
    expect(await product.balanceOf(notDeployer.address)).to.equal(quantity.mul(2));
  });

  it('Withdraw a single bidders bid', async () => {
    await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
    await expect(marketplace.connect(notDeployer).withdrawBid(listingId, 0))
      .to.emit(marketplace, 'BidWithdrawn')
      .withArgs(listingId, notDeployer.address, 0);
    expect(await currency.balanceOf(notDeployer.address)).to.equal(balance);
    expect(await currency.balanceOf(marketplace.address)).to.equal(0);
  });

  it('Withdraw a bidders bid from multiple', async () => {
    await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
    await marketplace.connect(notDeployer).bid(listingId, quantity.mul(2), payment.mul(3));
    await marketplace.connect(notDeployer).bid(listingId, quantity.div(4), payment.mul(5));
    await marketplace.connect(notDeployer).withdrawBid(listingId, 1);
    const firstBid = await marketplace.bids(listingId, notDeployer.address, 0);
    expect(firstBid.quantity).to.equal(quantity);
    expect(firstBid.payment).to.equal(payment);
    const secondBid = await marketplace.bids(listingId, notDeployer.address, 1);
    expect(secondBid.quantity).to.equal(quantity.div(4));
    expect(secondBid.payment).to.equal(payment.mul(5));
    await expect(marketplace.bids(listingId, notDeployer.address, 2)).to.be.reverted;
    expect(await currency.balanceOf(marketplace.address)).to.equal(payment.add(payment.mul(5)));
    expect(await currency.balanceOf(notDeployer.address)).to.equal(balance.sub(payment.mul(6)));
  });

  // it('Withdraw a bidders bid from multiple', async () => {
  //   await marketplace.connect(notDeployer).bid(listingId, quantity, payment);
  //   await marketplace.connect(notDeployer).withdrawBid(listingId, 0);
  // });
});

// npx hardhat test test/Bid.js
