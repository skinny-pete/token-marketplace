//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/// @title A marketplace for selling and bidding on ERC20s and ERC721s
/// @author Theo Dale & Peter Whitby
/// @notice This marketplace allows whitelisted seller and buyers to list / purchase tokens

contract ChangeblockMarketplace is Ownable {
    // -------------------- STRUCTS --------------------

    struct ERC20Listing {
        uint256 amount;
        uint256 price;
        address vendor;
        address product;
        address currency;
    }

    struct ERC721Listing {
        uint256 id;
        uint256 price;
        address vendor;
        address product;
        address currency;
    }

    struct Bid {
        uint256 quantity;
        uint256 payment;
        address bidder;
    }

    // -------------------- STATE VARIABLES --------------------

    /// @notice Seller whitelist.
    mapping(address => bool) public sellerApprovals;

    /// @notice Buyer whitelist.
    mapping(address => bool) public buyerApprovals;

    mapping(uint256 => ERC20Listing) public ERC20listings;
    mapping(uint256 => ERC721Listing) public ERC721listings;

    /// @notice Bids for each listing.
    /// @dev Maps listingId => bidId => Bid.
    mapping(uint256 => mapping(uint256 => Bid)) bids;

    uint256 public FEE_NUMERATOR;
    uint256 public FEE_DENOMINATOR;

    address TREASURY;

    // -------------------- EVENTS --------------------

    /// @notice event for an ERC20 listing
    /// @param amount the quantity of tokens to make available for sale - they are locked
    /// @param price the price for one token
    /// @param vendor the address of the lister
    /// @param product the address of the token being sold
    /// @param currency the address of the token used as payment (eg a stablecoin)
    /// @param listingId the unique ID of this listing
    event ERC20Registration(
        uint256 amount,
        uint256 price,
        address indexed vendor,
        address indexed product,
        address currency,
        uint256 listingId
    );
    /// @notice event for an ERC721 listing
    /// @param id the ERC721 ID of the NFT being sold (not listingId)
    /// @param price the price of the NFT
    /// @param vendor the address of the lister
    /// @param product the address of the NFT being sold
    /// @param currency the address of the token used as payment (eg a stablecoin)
    /// @param listingId the unique ID of this listing
    event ERC721Registration(
        uint256 id,
        uint256 price,
        address indexed vendor,
        address indexed product,
        address currency,
        uint256 listingId
    );

    /// @notice event for a bid being placed (only applicable to ERC20s)
    /// @param listingId the id of the listing being bid on
    /// @param quantity the number of tokens the buyer wishes to purchase
    /// @param price the price per token the buyer is offering to pay
    /// @param bidder the address of the account placing the bid
    event BidPlaced(
        uint256 indexed listingId,
        uint256 bidId,
        uint256 quantity,
        uint256 price,
        address bidder
    );

    /// @notice event for a bid being withdrawn (the user cancels their bid before it has been fulfilled)
    /// @param listingId the ID of the listing from which the bid is withdrawn
    /// @param bidder the address of the account withdrawing the bid
    event BidWithdrawn(uint256 indexed listingId, address bidder);

    /// @notice event for the removal of a listing
    /// @param listingId the ID of the listing removed
    event Removal(uint256 indexed listingId);

    /// @notice event emitted when a sale is completed
    /// @param listingId ID of the listing
    event Sale(uint256 indexed listingId);

    // -------------------- MODIFIERS --------------------

    modifier onlyBuyer() {
        require(buyerApprovals[msg.sender], 'Approved buyers only');
        _;
    }

    modifier onlySeller() {
        require(sellerApprovals[msg.sender], 'Approved sellers only');
        _;
    }

    ///@notice Contract constructor.
    ///@dev Sale fee is calculated by feeNumerator/feeDenominator.
    ///@param feeNumerator Numerator for fee calculation.
    ///@param feeDenominator Denominator for fee calculation.
    ///@param treasury Address to send fees to.
    ///@dev Warning: no checks are performed on the treasury address - make sure you have the private key for this account!
    constructor(
        uint256 feeNumerator,
        uint256 feeDenominator,
        address treasury
    ) {
        FEE_NUMERATOR = feeNumerator;
        FEE_DENOMINATOR = feeDenominator;
        TREASURY = treasury;
    }

    // -------------------- PURCHASING METHODS --------------------

    function buyERC20(uint256 listingId, uint256 amount) public onlyBuyer {
        ERC20Listing memory listing = ERC20listings[listingId];
        require(listing.currency != address(0), 'invalid ID provided');
        uint256 payment = amount * listing.price;
        uint256 fee = (payment * FEE_NUMERATOR) / FEE_DENOMINATOR;
        IERC20(listing.currency).transferFrom(
            msg.sender,
            listing.vendor,
            payment
        );
        IERC20(listing.currency).transferFrom(msg.sender, TREASURY, fee);
        require(listing.amount >= amount, 'Insufficient listed tokens');
        IERC20(listing.product).transfer(msg.sender, amount);
        ERC20listings[listingId].amount -= amount;
        emit Sale(listingId);
    }

    function buyERC721(uint256 listingId) public onlyBuyer {
        ERC721Listing memory listing = ERC721listings[listingId];
        require(listing.currency != address(0), 'invalid ID provided');
        uint256 fee = (listing.price * FEE_NUMERATOR) / FEE_DENOMINATOR;
        IERC20(listing.currency).allowance(msg.sender, address(this));
        IERC20(listing.currency).transferFrom(
            msg.sender,
            listing.vendor,
            listing.price
        );
        IERC20(listing.currency).transferFrom(msg.sender, TREASURY, fee);
        IERC721(listing.product).transferFrom(
            address(this),
            msg.sender,
            listing.id
        );
        emit Sale(listingId);
    }

    // -------------------- LISTING METHODS --------------------

    function listERC20(
        uint256 amount,
        uint256 price,
        address product,
        address currency
    ) public onlySeller returns (uint256) {
        IERC20(product).transferFrom(msg.sender, address(this), amount);
        uint256 listingId = uint256(
            keccak256(abi.encode(amount, price, msg.sender, product, currency))
        );
        ERC20listings[listingId] = ERC20Listing(
            amount + ERC20listings[listingId].amount,
            price,
            msg.sender,
            product,
            currency
        );
        emit ERC20Registration(
            amount,
            price,
            msg.sender,
            product,
            currency,
            listingId
        );

        return listingId;
    }

    function listERC721(
        uint256 id,
        uint256 price,
        address product,
        address currency
    ) public onlySeller returns (uint256) {
        IERC721(product).transferFrom(msg.sender, address(this), id);
        uint256 listingId = uint256(
            keccak256(abi.encode(id, price, msg.sender, product, currency))
        );
        ERC721listings[listingId] = ERC721Listing(
            id,
            price,
            msg.sender,
            product,
            currency
        );
        emit ERC721Registration(
            id,
            price,
            msg.sender,
            product,
            currency,
            listingId
        );

        return listingId;
    }

    function delistERC20(uint256 amount, uint256 listingId) public {
        ERC20Listing memory listing = ERC20listings[listingId];
        require(
            listing.vendor == msg.sender || owner() == msg.sender,
            'Only vendor or marketplace owner can delist'
        );
        require(listing.amount >= amount, 'Insufficient tokens listed');
        IERC20(listing.product).transfer(listing.vendor, amount);
        ERC20listings[listingId].amount -= amount;
        emit Removal(listingId);
    }

    function delistERC721(uint256 listingId) public {
        ERC721Listing memory listing = ERC721listings[listingId];
        require(
            listing.vendor == msg.sender || owner() == msg.sender,
            'Only vendor or marketplace owner can delist'
        );
        IERC721(listing.product).transferFrom(
            address(this),
            listing.vendor,
            listing.id
        );
        emit Removal(listingId);
    }

    // -------------------- BIDDING --------------------

    /// @param quantity The amount of tokens being bid for - e.g. a bid for 1000 CBTs.
    /// @param payment The total size of the bid being made - e.g. a bid of 550 USDC.
    function bid(
        uint256 listingId,
        uint256 quantity,
        uint256 payment
    ) public onlyBuyer {
        ERC20Listing memory listing = ERC20listings[listingId];
        require(
            IERC20(listing.currency).transferFrom(
                msg.sender,
                address(this),
                payment
            )
        );
        uint256 bidId = uint256(
            keccak256(abi.encode(quantity, payment, msg.sender))
        );
        bids[listingId][bidId].bidder = msg.sender;
        bids[listingId][bidId].quantity += quantity;
        bids[listingId][bidId].payment += payment;
        emit BidPlaced(listingId, bidId, quantity, payment, msg.sender);
    }

    /// @param listingId The listing that the accepted bid was made for
    /// @param bidId The ID of the bid being accepted
    function acceptBid(uint256 listingId, uint256 bidId) public {
        address vendor = ERC20listings[listingId].vendor;
        require(vendor == msg.sender, 'Only vendor can accept a bid');
        uint256 quantity = bids[listingId][bidId].quantity;
        require(
            ERC20listings[listingId].amount >= quantity,
            'Insufficient tokens listed to fulfill bid'
        );
        IERC20(ERC20listings[listingId].currency).transfer(
            vendor,
            bids[listingId][bidId].payment
        );
        IERC20(ERC20listings[listingId].product).transfer(msg.sender, quantity);
        ERC20listings[listingId].amount -= quantity;
        delete bids[listingId][bidId];
    }

    function withdrawBid(uint256 listingId, uint256 bidId) public onlyBuyer {
        address bidder = bids[listingId][bidId].bidder;
        require(msg.sender == bidder, 'Only bidder can cancel a bid');
        IERC20(ERC20listings[listingId].currency).transfer(
            bidder,
            bids[listingId][bidId].payment
        );
        delete bids[listingId][bidId];
    }

    // -------------------- ADMIN --------------------

    // if we have this, we need to have an max price in the buy function
    function updatePrice() external {}

    function setSellers(address[] calldata targets, bool[] calldata approvals)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < targets.length; i++) {
            sellerApprovals[targets[i]] = approvals[i];
        }
    }

    function setBuyers(address[] calldata targets, bool[] calldata approvals)
        public
        onlyOwner
    {
        for (uint256 i = 0; i < targets.length; i++) {
            buyerApprovals[targets[i]] = approvals[i];
        }
    }

    function setFeeNumerator() external onlyOwner {}

    function setFeeDenominator() external onlyOwner {}
}
