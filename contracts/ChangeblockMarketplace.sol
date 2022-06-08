//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ChangeblockMarketplace is Ownable {
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
        uint quantity;
        uint price;
        address bidder;
    }

    event ERC20Registration(
        uint256 amount,
        uint256 price,
        address vendor,
        address product,
        address currency,
        uint256 listingId
    );

    event ERC721Registration(
        uint256 id,
        uint256 price,
        address vendor,
        address product,
        address currency,
        uint256 listingId
    );

    // BidPlaced(_listingId, _quantity, _price, msg.sender)
    event BidPlaced(uint listingId, uint quantity, uint price, address bidder);
    event BidWithdrawn(uint listingId, address bidder);

    event Removal(uint256 listingId);
    event Sale(uint256 listingId);

    mapping(address => bool) public sellerApprovals;
    mapping(address => bool) public buyerApprovals;

    //listingId => bids
    mapping(uint256 => Bid[]) public bids;

    //Account => listingId => indexOfBidInBids;
    mapping(address => mapping(uint => uint)) bidMap;

    mapping(address => mapping(uint => bool)) hasBid;

    //Bidding process:
    //user submits bid and transfers tokens to contract where they await approval.
    //user may withdraw bid at any time
    //the lister must check their listing to see if it has any bids pending

    modifier onlyBuyer() {
        require(buyerApprovals[msg.sender], "Approved buyers only");
        _;
    }

    modifier onlySeller() {
        require(sellerApprovals[msg.sender], "Approved sellers only");
        _;
    }

    mapping(uint256 => ERC20Listing) public ERC20listings;
    mapping(uint256 => ERC721Listing) public ERC721listings;

    uint256[] public ERC20listingIds;
    uint256[] public ERC721listingIds;

    uint256 public FEE_NUMERATOR;
    uint256 public FEE_DENOMINATOR;
    address TREASURY;

    constructor(
        uint256 feeNumerator,
        uint feeDenominator,
        address treasury
    ) {
        FEE_NUMERATOR = feeNumerator;
        FEE_DENOMINATOR = feeDenominator;
        TREASURY = treasury;
    }

    function popBid(uint listingId, uint index) internal {
        //Move last element to index, then delete last element
        //Obviously does not conserve order of elements
        uint l = bids[listingId].length;
        require(index < l);
        bids[listingId][index] = bids[listingId][l - 1];
        delete bids[listingId][l - 1];
    }

    function listERC20(
        uint256 amount,
        uint256 price,
        address product,
        address currency
    ) public onlySeller {
        IERC20(product).transferFrom(msg.sender, address(this), amount);
        uint256 listingId = uint256(
            keccak256(abi.encode(amount, price, msg.sender, product, currency))
        );
        ERC20listingIds.push(listingId);
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
    }

    function listERC721(
        uint256 id,
        uint256 price,
        address product,
        address currency
    ) public onlySeller {
        IERC721(product).transferFrom(msg.sender, address(this), id);
        uint256 listingId = uint256(
            keccak256(abi.encode(id, price, msg.sender, product, currency))
        );
        ERC721listingIds.push(listingId);
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
    }

    function buyERC20(uint256 listingId, uint256 amount) public onlyBuyer {
        ERC20Listing memory listing = ERC20listings[listingId];
        require(listing.currency != address(0), "invalid ID provided");
        uint256 payment = amount * listing.price;
        uint256 fee = (payment * FEE_NUMERATOR) / FEE_DENOMINATOR;
        IERC20(listing.currency).transferFrom(
            msg.sender,
            listing.vendor,
            payment
        );
        IERC20(listing.currency).transferFrom(msg.sender, TREASURY, fee);
        require(listing.amount >= amount, "Insufficient listed tokens");
        IERC20(listing.product).transfer(msg.sender, amount);
        ERC20listings[listingId].amount -= amount;
        emit Sale(listingId);
    }

    function buyERC721(uint256 listingId) public onlyBuyer {
        ERC721Listing memory listing = ERC721listings[listingId];
        require(listing.currency != address(0), "invalid ID provided");
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

    function bidERC20(
        uint256 _listingId,
        uint _quantity,
        uint _price
    ) public onlyBuyer {
        ERC20Listing memory listing = ERC20listings[_listingId];
        require(
            IERC20(listing.currency).transferFrom(
                msg.sender,
                address(this),
                _quantity * _price
            )
        );

        bids[_listingId].push(Bid(_quantity, _price, msg.sender));
        uint l = bids[_listingId].length;
        bidMap[msg.sender][_listingId] = l - 1;
        hasBid[msg.sender][_listingId] = true;
        emit BidPlaced(_listingId, _quantity, _price, msg.sender);
    }

    function respondBid(
        uint listingId,
        uint index,
        bool accept
    ) public onlySeller {
        ERC20Listing memory listing = ERC20listings[listingId];
        require(msg.sender == listing.vendor, "Not your listing");
        require(
            !hasBid[msg.sender][listingId],
            "Withdraw existing listing first"
        );
        Bid storage bid = bids[listingId][index];
        if (accept) {
            uint payment = bid.price * bid.quantity;
            uint fee = (payment * FEE_NUMERATOR) / FEE_NUMERATOR;
            IERC20(listing.product).transfer(bid.bidder, bid.quantity);
            ERC20listings[listingId].amount -= bid.quantity;

            IERC20(listing.currency).transfer(TREASURY, fee);
            IERC20(listing.currency).transfer(listing.vendor, payment - fee);
        } else {
            IERC20(listing.currency).transfer(
                bid.bidder,
                bid.price * bid.quantity
            );
        }
        popBid(listingId, index);
    }

    function withdrawBid(uint listingId) public onlyBuyer {
        //TODO!
        require(hasBid[msg.sender][listingId], "No bid to withdraw");
        uint index = bidMap[msg.sender][listingId];
        Bid memory bid = bids[listingId][index];
        ERC20Listing memory listing = ERC20listings[listingId];
        uint amount = bid.price * bid.quantity;
        IERC20(listing.currency).transfer(msg.sender, amount);
        hasBid[msg.sender][listingId] = false;

        popBid(listingId, index);
    }

    function delistERC20(uint256 amount, uint256 listingId) public {
        ERC20Listing memory listing = ERC20listings[listingId];
        require(
            listing.vendor == msg.sender || owner() == msg.sender,
            "Only vendor or marketplace owner can delist"
        );
        require(listing.amount >= amount, "Insufficient tokens listed");
        IERC20(listing.product).transfer(listing.vendor, amount);
        ERC20listings[listingId].amount -= amount;
        emit Removal(listingId);
    }

    function delistERC721(uint256 listingId) public {
        ERC721Listing memory listing = ERC721listings[listingId];
        require(
            listing.vendor == msg.sender || owner() == msg.sender,
            "Only vendor or marketplace owner can delist"
        );
        IERC721(listing.product).transferFrom(
            address(this),
            listing.vendor,
            listing.id
        );
        emit Removal(listingId);
    }

    function approveSeller(address seller, bool approval) public onlyOwner {
        sellerApprovals[seller] = approval;
    }

    function approveBuyer(address buyer, bool approval) public onlyOwner {
        buyerApprovals[buyer] = approval;
    }
}
