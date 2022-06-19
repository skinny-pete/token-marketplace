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

    // -------------------- STATE VARIABLES --------------------

    /// @notice Seller whitelist.
    mapping(address => bool) public sellerApprovals;

    /// @notice Buyer whitelist.
    mapping(address => bool) public buyerApprovals;

    mapping(uint256 => ERC20Listing) public ERC20Listings;
    mapping(uint256 => ERC721Listing) public ERC721Listings;

    // /// @notice Bids for each listing.
    // /// @dev Maps listingId => bidId => Bid.
    // mapping(uint256 => mapping(uint256 => Bid)) public bids;

    // // listing Id => list of bidIds
    // mapping(uint256 => uint256[]) publicbidders;

    // // listing Id => bidId => index
    // mapping(uint256 => mapping(uint256 => uint256)) bidIndexes;

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

    event ERC20PriceUpdate(uint256 indexed listingId, uint256 price);

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
        uint256 quantity,
        uint256 price,
        address bidder
    );

    /// @notice event for a bid being withdrawn (the user cancels their bid before it has been fulfilled)
    /// @param listingId the ID of the listing from which the bid is withdrawn
    /// @param bidder the address of the account withdrawing the bid
    event BidWithdrawn(uint256 indexed listingId, address bidder);

    // /// @notice event for the removal of a listing
    // /// @param listingId the ID of the listing removed
    // event Removal(uint256 indexed listingId);

    /// @notice event emitted when a sale is completed
    /// @param listingId ID of the listing
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
    /// @dev Sale fee is calculated by feeNumerator/feeDenominator.
    /// @param feeNumerator Numerator for fee calculation.
    /// @param feeDenominator Denominator for fee calculation.
    /// @param treasury Address to send fees to.
    /// @dev Warning: no checks are performed on the treasury address - make sure you have the private key for this account!
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

    // Add price parameter to alll buy functions

    function buyERC20(
        uint256 listingId,
        uint256 amount,
        uint256 price
    ) public onlyBuyer {
        ERC20Listing memory listing = ERC20Listings[listingId];
        require(
            listing.currency != address(0),
            'Non-valid listing ID provided'
        );
        require(listing.price == price, 'Cannot make purchase at input price');
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
        ERC20Listings[listingId].amount -= amount;
        emit Sale(listingId);
    }

    function buyERC721(uint256 listingId, uint256 price) public onlyBuyer {
        ERC721Listing memory listing = ERC721Listings[listingId];
        require(
            listing.currency != address(0),
            'Non-valid listing ID provided'
        );
        require(listing.price == price, 'Cannot make purchase at input price');
        uint256 fee = (listing.price * FEE_NUMERATOR) / FEE_DENOMINATOR;
        // IERC20(listing.currency).allowance(msg.sender, address(this));
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

    /// @dev Listed token price is set to `price` parameter
    function listERC20(
        uint256 amount,
        uint256 price,
        address product,
        address currency
    ) public onlySeller returns (uint256) {
        IERC20(product).transferFrom(msg.sender, address(this), amount); // does this need a require check?
        uint256 listingId = uint256(
            keccak256(abi.encode(msg.sender, product, currency))
        );
        ERC20Listings[listingId] = ERC20Listing(
            amount + ERC20Listings[listingId].amount,
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
        IERC721(product).transferFrom(msg.sender, address(this), id); // does this need a require check?
        uint256 listingId = uint256(keccak256(abi.encode(id, product)));
        ERC721Listings[listingId] = ERC721Listing(
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
        IERC721(listing.product).transferFrom(
            address(this),
            listing.vendor,
            listing.id
        );
        delete ERC721Listings[listingId];
    }

    // -------------------- BIDDING --------------------

    struct Bid {
        uint256 quantity;
        uint256 payment;
    }

    /// @notice Bids for each listing.
    /// @dev Maps listingId => bidder => Bid.
    mapping(uint256 => mapping(address => Bid)) public bids;

    // listing Id => list of its bidders
    mapping(uint256 => address[]) public bidders;

    // listing Id => bidder => index
    mapping(uint256 => mapping(address => uint256)) bidderIndexes;

    /// @param quantity The amount of tokens being bid for - e.g. a bid for 1000 CBTs.
    /// @param payment The total size of the bid being made - e.g. a bid of 550 USDC.
    function bid(
        uint256 listingId,
        uint256 quantity,
        uint256 payment
    ) public onlyBuyer {
        bidderIndexes[listingId][msg.sender] = bidders[listingId].length;
        bidders[listingId].push(msg.sender);
        bids[listingId][msg.sender] = Bid(quantity, payment);
        emit BidPlaced(listingId, quantity, payment, msg.sender);
    }

    // fee on bid herer needed

    // /// @param listingId The listing that the accepted bid was made for
    // /// @param bidId The ID of the bid being accepted
    // // only accept at a given price
    // function acceptBid(
    //     uint256 listingId,
    //     uint256 bidId,
    //     uint256 price
    // ) public {
    //     address vendor = ERC20Listings[listingId].vendor;
    //     require(vendor == msg.sender, 'Only vendor can accept a bid');
    //     uint256 quantity = bids[listingId][bidId].quantity;
    //     require(
    //         ERC20Listings[listingId].amount >= quantity,
    //         'Insufficient tokens listed to fulfill bid'
    //     );
    //     IERC20(ERC20Listings[listingId].currency).transfer(
    //         vendor,
    //         bids[listingId][bidId].payment
    //     );
    //     IERC20(ERC20Listings[listingId].product).transfer(msg.sender, quantity);
    //     ERC20Listings[listingId].amount -= quantity;
    //     _removeBid(listingId, bidId);
    //     delete bids[listingId][bidId];
    // }

    // function withdrawBid(uint256 listingId, uint256 bidId) public onlyBuyer {
    //     address bidder = bids[listingId][bidId].bidder;
    //     require(msg.sender == bidder, 'Only bidder can cancel a bid');
    //     IERC20(ERC20Listings[listingId].currency).transfer(
    //         bidder,
    //         bids[listingId][bidId].payment
    //     );
    //     _removeBid(listingId, bidId);
    //     delete bids[listingId][bidId];
    // }

    // -------------------- ADMIN --------------------

    // WHAT OTHER ADMIN EFFECTS COULD WE NEED? e.g. pauseable, only permitting certain tokens...

    // if we have this, we need to have an max price in the buy function
    function updateERC20Price(uint256 listingId, uint256 price) external {
        require(
            msg.sender == ERC20Listings[listingId].vendor,
            'Only vendor can update price'
        );
        ERC20Listings[listingId].price = price;
        // EVENT
    }

    function updateERC721Price(uint256 listingId, uint256 price) external {
        require(
            msg.sender == ERC721Listings[listingId].vendor,
            'Only vendor can update price'
        );
        ERC721Listings[listingId].price = price;
        // EVENT
    }

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

    // -------------------- INTERNAL --------------------

    // function _removeBid(uint256 listingId, uint256 bidId) internal {
    //     bidders[listingId][bidIndexes[listingId][bidId]] = bidders[listingId][
    //         currentBids[listingId].length - 1
    //     ];
    //     bidders[listingId].pop();
    //     delete bidIndexes[listingId][bidId]; // is this necessary?
    // }
}
