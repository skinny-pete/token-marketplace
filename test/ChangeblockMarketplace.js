const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const {
  getListingId,
  mintAndApproveERC20,
  mintAndApproveERC721,
} = require("../utils.js");

describe("ChangeblockMarketplace", function () {
  let deployer;
  let buyer;
  let treasury;
  let marketplace;
  let marketplaceFactory;
  let mintableERC20Factory;
  let mintableERC721Factory;
  let stableCoin;
  let ecoToken;
  let ecoNFT;

  before(async () => {
    [deployer, buyer, treasury] = await ethers.getSigners();
    marketplaceFactory = await ethers.getContractFactory(
      "ChangeblockMarketplace"
    );
    mintableERC20Factory = await ethers.getContractFactory("MintableERC20");
    mintableERC721Factory = await ethers.getContractFactory("MintableERC721");
  });

  const feeNumerator = ethers.BigNumber.from("5");
  const feeDenominator = ethers.BigNumber.from("100");

  beforeEach(async () => {
    marketplace = await marketplaceFactory.deploy(
      feeNumerator,
      feeDenominator,
      treasury.address
    );
    stableCoin = await mintableERC20Factory.deploy("Stable Coin", "SC");
    ecoToken = await mintableERC20Factory.deploy("Eco Token", "ET");
    ecoNFT = await mintableERC721Factory.deploy("Eco NFT", "ENFT");
  });

  it("Set approval", async () => {
    await marketplace.approveSeller(buyer.address, true);
    expect(await marketplace.sellerApprovals(buyer.address)).to.equal(true);
  });

  const amount = ethers.utils.parseEther("250");
  const ecoTokenPrice = ethers.BigNumber.from("2");

  // ------------------- ERC20s -------------------

  it("List ERC20 tokens", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );
    expect(
      await marketplace.listERC20(
        amount,
        ecoTokenPrice,
        ecoToken.address,
        stableCoin.address
      )
    )
      .to.emit(marketplace, "ERC20Registration")
      .withArgs(
        amount,
        ecoTokenPrice,
        deployer.address,
        ecoToken.address,
        stableCoin.address,
        listingId
      );
  });

  it("Buy ERC20 tokens", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );
    const basePayment = ecoTokenPrice.mul(amount);
    const fee = basePayment.mul(feeNumerator).div(feeDenominator);
    await mintAndApproveERC20(
      stableCoin,
      basePayment.add(fee),
      buyer,
      marketplace
    );
    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );
    await marketplace.approveBuyer(buyer.address, true);
    expect(await marketplace.connect(buyer).buyERC20(listingId, amount))
      .to.emit(marketplace, "Sale")
      .withArgs(listingId);
    expect(await stableCoin.balanceOf(deployer.address)).to.equal(
      ecoTokenPrice.mul(amount)
    );
    expect(await ecoToken.balanceOf(buyer.address)).to.equal(amount);
  });

  // ------------------- ERC721s -------------------

  const ecoNFTId = ethers.BigNumber.from("0");
  const ecoNFTPrice = ethers.utils.parseEther("250");

  it("List an ERC721 token", async () => {
    await mintAndApproveERC721(ecoNFT, ecoNFTId, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    const listingId = getListingId(
      ecoNFTId,
      ecoNFTPrice,
      deployer,
      ecoNFT,
      stableCoin
    );
    expect(
      await marketplace.listERC721(
        ecoNFTId,
        ecoNFTPrice,
        ecoNFT.address,
        stableCoin.address
      )
    )
      .to.emit(marketplace, "ERC721Registration")
      .withArgs(
        ecoNFTId,
        ecoNFTPrice,
        deployer.address,
        ecoNFT.address,
        stableCoin.address,
        listingId
      );
  });

  it("Buy an ERC721 token", async () => {
    await mintAndApproveERC721(ecoNFT, ecoNFTId, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC721(
      ecoNFTId,
      ecoNFTPrice,
      ecoNFT.address,
      stableCoin.address
    );
    const listingId = getListingId(
      ecoNFTId,
      ecoNFTPrice,
      deployer,
      ecoNFT,
      stableCoin
    );
    const fee = ecoNFTPrice.mul(feeNumerator).div(feeDenominator);
    await mintAndApproveERC20(
      stableCoin,
      ecoNFTPrice.add(fee),
      buyer,
      marketplace
    );
    await marketplace.approveBuyer(buyer.address, true);
    expect(await marketplace.connect(buyer).buyERC721(listingId))
      .to.emit(marketplace, "Sale")
      .withArgs(listingId);
    expect(await stableCoin.balanceOf(deployer.address)).to.equal(ecoNFTPrice);
    expect(await ecoNFT.ownerOf(ecoNFTId)).to.equal(buyer.address);
  });

  it("Reverts if invalid ID supplied", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );
    await marketplace.approveBuyer(buyer.address, true);
    let invalidID = getListingId(
      ethers.utils.parseEther("10"),
      amount,
      deployer,
      stableCoin,
      ecoToken
    );
    mintAndApproveERC20(
      stableCoin,
      amount.mul(ecoTokenPrice),
      buyer,
      marketplace
    );
    await expect(
      marketplace.connect(buyer).buyERC20(invalidID, amount)
    ).to.be.revertedWith("invalid ID provided");
  });
  it("Reverts if user buys listing with insufficient stock", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );
    const tooMuch = ethers.utils.parseEther("255");
    await mintAndApproveERC20(
      stableCoin,
      ethers.utils.parseEther("1000000000"),
      buyer,
      marketplace
    );
    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );
    await marketplace.approveBuyer(buyer.address, true);
    await expect(
      marketplace.connect(buyer).buyERC20(listingId, tooMuch)
    ).to.be.revertedWith("Insufficient listed tokens");
  });

  it("Allows lister to delist ERC20", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );

    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );

    const toDelist = ethers.utils.parseEther("125");
    await expect(marketplace.connect(deployer).delistERC20(toDelist, listingId))
      .to.emit(marketplace, "Removal")
      .withArgs(listingId);

    expect((await marketplace.ERC20listings(listingId)).amount).to.equal(
      amount.sub(toDelist)
    );

    expect(await ecoToken.balanceOf(deployer.address)).to.equal(toDelist);
  });

  it("Collects correct fees", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );
    const basePayment = ecoTokenPrice.mul(amount);
    const fee = basePayment.mul(feeNumerator).div(feeDenominator);
    await mintAndApproveERC20(
      stableCoin,
      basePayment.add(fee),
      buyer,
      marketplace
    );
    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );
    await marketplace.approveBuyer(buyer.address, true);
    await marketplace.connect(buyer).buyERC20(listingId, amount);

    expect(await stableCoin.balanceOf(treasury.address)).to.equal(fee);
  });

  it("Prevents unapproved user from buying ERC20", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );
    const basePayment = ecoTokenPrice.mul(amount);
    const fee = basePayment.mul(feeNumerator).div(feeDenominator);
    await mintAndApproveERC20(
      stableCoin,
      basePayment.add(fee),
      buyer,
      marketplace
    );
    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );
    await expect(
      marketplace.connect(buyer).buyERC20(listingId, amount)
    ).to.be.revertedWith("Approved buyers only");
  });

  it("Prevents unapproved user from buying ERC721s", async () => {
    await mintAndApproveERC721(ecoNFT, ecoNFTId, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC721(
      ecoNFTId,
      ecoNFTPrice,
      ecoNFT.address,
      stableCoin.address
    );
    const listingId = getListingId(
      ecoNFTId,
      ecoNFTPrice,
      deployer,
      ecoNFT,
      stableCoin
    );
    const fee = ecoNFTPrice.mul(feeNumerator).div(feeDenominator);
    await mintAndApproveERC20(
      stableCoin,
      ecoNFTPrice.add(fee),
      buyer,
      marketplace
    );
    await expect(
      marketplace.connect(buyer).buyERC721(listingId)
    ).to.be.revertedWith("Approved buyers only");
  });

  it("Prevents an unapproved seller from listing ERC20", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await expect(
      marketplace.listERC20(
        amount,
        ecoTokenPrice,
        ecoToken.address,
        stableCoin.address
      )
    ).to.be.revertedWith("Approved sellers only");
  });

  it("Prevents unapproved seller from listing ERC721", async () => {
    await mintAndApproveERC721(ecoNFT, ecoNFTId, deployer, marketplace);
    const listingId = getListingId(
      ecoNFTId,
      ecoNFTPrice,
      deployer,
      ecoNFT,
      stableCoin
    );
    await expect(
      marketplace.listERC721(
        ecoNFTId,
        ecoNFTPrice,
        ecoNFT.address,
        stableCoin.address
      )
    ).to.be.revertedWith("Approved sellers only");
  });

  it("Allows bidding", async () => {
    await mintAndApproveERC20(ecoToken, amount, deployer, marketplace);
    await marketplace.approveSeller(deployer.address, true);
    await marketplace.listERC20(
      amount,
      ecoTokenPrice,
      ecoToken.address,
      stableCoin.address
    );
    const basePayment = ecoTokenPrice.mul(amount);
    const fee = basePayment.mul(feeNumerator).div(feeDenominator);
    await mintAndApproveERC20(
      stableCoin,
      basePayment.add(fee),
      buyer,
      marketplace
    );
    const listingId = getListingId(
      amount,
      ecoTokenPrice,
      deployer,
      ecoToken,
      stableCoin
    );
    await marketplace.approveBuyer(buyer.address, true);

    const bidPrice = ethers.utils.parseEther("10");
    const bidQuantity = ethers.utils.parseEther("15");

    await expect(marketplace.connect(buyer).bidERC20(listingId));
  });
});

// npx hardhat test test/ChangeblockMarketplace.js
