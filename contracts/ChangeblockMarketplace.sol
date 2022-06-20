//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import 'hardhat/console.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

/// @title Changeblock Marketplace
/// @author Theo Dale & Peter Whitby
/// @notice This marketplace allows whitelisted sellers/buyers to list/purchase ERC20 and ERC721 tokens.

contract ChangeblockMarketplace is Ownable {
    // -------------------- STRUCTS --------------------

    // Represents one or more ERC20 tokens listed for-sale.
    struct ERC20Listing {
        uint256 amount;
        uint256 price;
        address vendor;
        address product;
        address currency;
    }

    // Represents an ERC721 listed for sale.
    struct ERC721Listing {
        uint256 id;
        uint256 price;
        address vendor;
        address product;
        address currency;
    }

    // Represents a bid made for a quantity of listed ERC20 tokens.
    struct Bid {
        uint256 quantity;
        uint256 payment;
    }

    // -------------------- STATE VARIABLES --------------------

    /// @notice Seller whitelist.
    mapping(address => bool) public sellerApprovals;

    /// @notice Buyer whitelist.
    mapping(address => bool) public buyerApprovals;

    /// @notice The ERC20 listings made on this marketplace.
    /// @dev Maps listingId to an ERC20Listing struct.
    mapping(uint256 => ERC20Listing) public ERC20Listings;

    /// @notice The ERC721 listings made on this marketplace.
    /// @dev Maps listingId to an ERC721Listing struct.
    mapping(uint256 => ERC721Listing) public ERC721Listings;

    /// @notice The bids a bidder has made for each listing.
    /// @dev Maps listingId => bidder => their bids on listing.
    mapping(uint256 => mapping(address => Bid[])) public bids;

    uint256 public FEE_NUMERATOR;
    uint256 public FEE_DENOMINATOR;

    address TREASURY;

    // -------------------- EVENTS --------------------

    event ERC20Registration(
        uint256 amount,
        uint256 price,
        address indexed vendor,
        address indexed product,
        address currency,
        uint256 listingId
    );

    event ERC20PriceUpdate(uint256 indexed listingId, uint256 price);

    event ERC721Registration(
        uint256 id,
        uint256 price,
        address indexed vendor,
        address indexed product,
        address currency,
        uint256 listingId
    );

    event BidPlaced(
        uint256 indexed listingId,
        uint256 quantity,
        uint256 price,
        address bidder,
        uint256 index
    );

    event BidWithdrawn(uint256 indexed listingId, address bidder, uint256 index);

    event BidAccepted(uint256 indexed listingId, address bidder, uint256 quantity, uint256 payment);

    event Removal(uint256 indexed listingId);

    event Sale(uint256 indexed listingId);

    // -------------------- MODIFIERS --------------------

    // Modifier to only permit function calls from approved buyers
    modifier onlyBuyer() {
        require(buyerApprovals[msg.sender], 'Approved buyers only');
        _;
    }

    // Modifier to only permit function calls from approved sellers
    modifier onlySeller() {
        require(sellerApprovals[msg.sender], 'Approved sellers only');
        _;
    }

    /// @notice Contract constructor.
    /// @param feeNumerator Numerator for fee calculation.
    /// @param feeDenominator Denominator for fee calculation.
    /// @param treasury Address to send fees to.
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

    // PAYMENT - on top of or from input parameter

    /// @notice Call to purchase some listed ERC20 tokens.
    /// @dev Token price is included as a parameter to prevent price manipulation.
    /// @param listingId The ID of the listing whose tokens the caller wishes to purchase.
    /// @param amount The amount of listed tokens the caller wishes to purchase.
    /// @param price The price at which the caller wishes to purchase the tokens.
    function buyERC20(
        uint256 listingId,
        uint256 amount,
        uint256 price
    ) public onlyBuyer {
        ERC20Listing memory listing = ERC20Listings[listingId];
        require(listing.price == price, 'Listed price not equal to input price');
        require(listing.amount >= amount, 'Insufficient listed tokens');
        uint256 payment = amount * price;
        uint256 fee = (payment * FEE_NUMERATOR) / FEE_DENOMINATOR;
        IERC20(listing.currency).transferFrom(msg.sender, listing.vendor, payment);
        IERC20(listing.currency).transferFrom(msg.sender, TREASURY, fee);
        IERC20(listing.product).transfer(msg.sender, amount);
        ERC20Listings[listingId].amount -= amount;
        emit Sale(listingId);
    }

    function buyERC721(uint256 listingId, uint256 price) public onlyBuyer {
        ERC721Listing memory listing = ERC721Listings[listingId];
        require(listing.price == price, 'Listed price not equal to input price');
        uint256 fee = (listing.price * FEE_NUMERATOR) / FEE_DENOMINATOR;
        IERC20(listing.currency).transferFrom(msg.sender, listing.vendor, listing.price);
        IERC20(listing.currency).transferFrom(msg.sender, TREASURY, fee);
        IERC721(listing.product).transferFrom(address(this), msg.sender, listing.id);
        delete ERC721Listings[listingId];
        emit Sale(listingId);
    }

    // -------------------- LISTING METHODS --------------------

    /// @dev Listed token price is set to `price` parameter
    function listERC20(
        uint256 amount,
        uint256 price,
        address product,
        address currency
    ) public onlySeller returns (uint256) {
        IERC20(product).transferFrom(msg.sender, address(this), amount); // does this need a require check?
        uint256 listingId = uint256(keccak256(abi.encode(msg.sender, product, currency)));
        ERC20Listings[listingId] = ERC20Listing(
            amount + ERC20Listings[listingId].amount,
            price,
            msg.sender,
            product,
            currency
        );
        emit ERC20Registration(amount, price, msg.sender, product, currency, listingId);
        return listingId;
    }

    function listERC721(
        uint256 id,
        uint256 price,
        address product,
        address currency
    ) public onlySeller returns (uint256) {
        IERC721(product).transferFrom(msg.sender, address(this), id); // does this need a require check?
        uint256 listingId = uint256(keccak256(abi.encode(id, product)));
        ERC721Listings[listingId] = ERC721Listing(id, price, msg.sender, product, currency);
        emit ERC721Registration(id, price, msg.sender, product, currency, listingId);
        return listingId;
    }

    // This method needs events
    function delistERC20(uint256 amount, uint256 listingId) public {
        ERC20Listing memory listing = ERC20Listings[listingId];
        require(
            listing.vendor == msg.sender || owner() == msg.sender,
            'Only vendor or marketplace owner can delist'
        );
        require(listing.amount >= amount, 'Insufficient tokens listed');
        IERC20(listing.product).transfer(listing.vendor, amount);
        if (listing.amount == amount) {
            delete ERC20Listings[listingId];
        } else {
            ERC20Listings[listingId].amount -= amount;
        }
    }

    // This method needs events
    function delistERC721(uint256 listingId) public {
        ERC721Listing memory listing = ERC721Listings[listingId];
        require(
            listing.vendor == msg.sender || owner() == msg.sender,
            'Only vendor or marketplace owner can delist'
        );
        IERC721(listing.product).transferFrom(address(this), listing.vendor, listing.id);
        delete ERC721Listings[listingId];
    }

    /// @notice Called by a vendor to change the price of listed ERC20s
    function updateERC20Price(uint256 listingId, uint256 price) external {
        require(msg.sender == ERC20Listings[listingId].vendor, 'Only vendor can update price');
        ERC20Listings[listingId].price = price;
        // EVENT
    }

    /// @notice Called by a vendor to change the price of a listed ERC721
    function updateERC721Price(uint256 listingId, uint256 price) external {
        require(msg.sender == ERC721Listings[listingId].vendor, 'Only vendor can update price');
        ERC721Listings[listingId].price = price;
        // EVENT
    }

    // -------------------- BIDDING --------------------

    /// @notice Bid an amount (payment) of a listing's currency for an amount (quantity) of its tokens.
    /// @dev Requires ERC20 approval for payment escrow.
    /// @param quantity The amount of tokens being bid for - e.g. a bid for 1000 CBTs.
    /// @param payment The total size of the bid being made - e.g. a bid of 550 USDC.
    function bid(
        uint256 listingId,
        uint256 quantity,
        uint256 payment
    ) public onlyBuyer {
        emit BidPlaced(
            listingId,
            quantity,
            payment,
            msg.sender,
            bids[listingId][msg.sender].length
        );
        bids[listingId][msg.sender].push(Bid(quantity, payment));
        IERC20(ERC20Listings[listingId].currency).transferFrom(msg.sender, address(this), payment);
    }

    /// @notice Called by bidder to withdraw their bid and claim bidded funds.
    /// @dev Deletes bid at index in bids[listingId][msg.sender].
    function withdrawBid(uint256 listingId, uint256 index) public {
        // require(bids[listingId][msg.sender].length > index, 'No bid at input index'); // is this necessary?
        IERC20(ERC20Listings[listingId].currency).transfer(
            msg.sender,
            bids[listingId][msg.sender][index].payment
        );
        _removeBid(listingId, msg.sender, index);
        emit BidWithdrawn(listingId, msg.sender, index);
    }

    /// @notice Called by vendor to accept a bid on their listing.
    /// @dev Takes input quantity/payment to prevent price being altered after transaction submission.
    function acceptBid(
        uint256 listingId,
        address bidder,
        uint256 index,
        uint256 quantity,
        uint256 payment
    ) public {
        require(msg.sender == ERC20Listings[listingId].vendor, 'Only vendor can accept bid');
        require(
            ERC20Listings[listingId].amount >= quantity,
            'Insufficient tokens listed to fulfill bid'
        );
        // Only needed if want clear exception
        // require(bids[listingId][bidder].length > index, 'No bid at input index'); // is this necessary?
        Bid memory bid_ = bids[listingId][bidder][index];
        require(
            bid_.quantity == quantity && bid_.payment == payment,
            'Bid at input index does not have input quantity and price'
        );
        uint256 fee = (payment * FEE_NUMERATOR) / FEE_DENOMINATOR;
        IERC20 currency = IERC20(ERC20Listings[listingId].currency);
        currency.transfer(msg.sender, payment - fee);
        currency.transfer(TREASURY, fee);
        IERC20(ERC20Listings[listingId].product).transfer(bidder, quantity);
        ERC20Listings[listingId].amount -= quantity;
        _removeBid(listingId, bidder, index);
        emit BidAccepted(listingId, bidder, quantity, payment);
    }

    // -------------------- ADMIN --------------------

    function setSellers(address[] calldata targets, bool[] calldata approvals) public onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            sellerApprovals[targets[i]] = approvals[i];
        }
        // EVENT
    }

    function setBuyers(address[] calldata targets, bool[] calldata approvals) public onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            buyerApprovals[targets[i]] = approvals[i];
        }
        // EVENT
    }

    function setFeeNumerator(uint256 feeNumerator) external onlyOwner {
        FEE_NUMERATOR = feeNumerator;
    }

    function setFeeDenominator(uint256 feeDenominator) external onlyOwner {
        FEE_DENOMINATOR = feeDenominator;
    }

    // -------------------- INTERNAL --------------------

    /// @dev Function for deleting a Bid
    function _removeBid(
        uint256 listingId,
        address bidder,
        uint256 index
    ) internal {
        bids[listingId][bidder][index] = bids[listingId][bidder][
            bids[listingId][bidder].length - 1
        ];
        bids[listingId][bidder].pop();
    }
}
