pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";

contract AssetShareApp is AragonApp {

    // Events
    event PAYMENT_RECEIVED(address sender, uint amount, string info);
    event TRESURY_DEPOSIT(address sender, uint amount, string info);
    event OWNERS_PAID();
    event NEW_OFFER(uint id);
    event COMPLETED_OFFER(uint id);
    event CANCELLED_OFFER(uint id);

    struct Owner {// used to store shareholder information
        uint shares;             // amount of shares owned by shareholder
        uint sharesOnSale;       // amount of the owner's shares currently on sale
        uint listPosition;       // position in the ownerList
    }

    enum OfferType {
        SELL,
        BUY
    }

    struct Offer {// describes an offer for selling / buying / gifting shares
        uint id;                  // offer id (index in the offerList.txt)
        OfferType offerType;      // the type of the offer (BUY or SELL)
        uint listPosition;        // position in the activeOffersList (MISSING if not active)
        address seller;           // address of the one making the offer
        address buyer;            // address of the intended recepient of the offer (empty for public auction)
        uint shares;              // amount of offered shares
        uint price;               // price of the shares in wei (set to 0 for gift)
        uint creationDate;        // unix timestamp of the date when the offer was published
        uint completionDate;      // unix timestamp of the date when the shares were transfered or the offer was cancelled
        bool cancelled;           // whether or not the offer was cancelled
    }

    uint constant public MISSING = ~uint256(0);                  // max uint value, signals missing data
    uint constant public TOTAL_SHARES = 1000000;                 // total number of ownership shares
    uint constant public TREASURY_RATIO_DENOMINATOR = 1000000;   // the ratio of ether placed in the treasury
    // = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR

    uint constant private DEFAULT_TREASURY_RATIO = 100000;       // default value of treasuryRatio
    uint constant private DEFAULT_PAYOUT_PERIOD = 60;            // default value of payoutPeriod

    string private assetDescription;                             // textual description of the asset

    address[] private ownerList;                                 // list of owner addresses
    mapping(address => Owner) private ownershipMap;              // maps each address to its respective owner information

    uint private treasuryBalance;               // wei in the treasury
    uint private treasuryRatio;                 // the ratio of ether placed in the treasury
    //     = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR
    uint private payoutPeriod;                  // time interval between shareholder payout (in seconds)
    uint private lastPayday;                    // unix timestamp of last theoretical* payout
    //     *Time when the payout should have happened

    Offer[] private offerList;                  // list of all offers
    uint[] private activeOffersList;            // list of indexes of active offers

    function initialize() public onlyInit {

        address initialOwner = address(0xb4124cEB3451635DAcedd11767f004d8a28c6eE7);

        // contract creator starts as sole owner
        addOwner(initialOwner, TOTAL_SHARES);

        // set default values
        treasuryBalance = 0;
        treasuryRatio = DEFAULT_TREASURY_RATIO;
        payoutPeriod = DEFAULT_PAYOUT_PERIOD;
        lastPayday = block.timestamp;

        initialized();

    }

    function getSharesByAddress(address owner) external view returns (uint) {
        return ownershipMap[owner].shares;
    }

    function getShares() external view returns (uint) {
        return ownershipMap[msg.sender].shares;
    }

    function getSharesOnSale(address owner) external view returns (uint) {
        return ownershipMap[owner].sharesOnSale;
    }

    function getSharesOnSale() external view returns (uint) {
        return ownershipMap[msg.sender].sharesOnSale;
    }

    function getOwnersCount() external view returns (uint) {
        return ownerList.length;
    }

    function getOwnerAddressByIndex(uint idx) external view returns (address) {
        return ownerList[idx];
    }

    // creates a new owner
    function addOwner(address ownerAddress, uint shares) internal {
        ownershipMap[ownerAddress] = Owner(shares, 0, ownerList.length);
        ownerList.push(ownerAddress);
    }

    // removes an owner from the ownerList
    function removeOwner(address ownerAddress) private {
        uint pos = ownershipMap[ownerAddress].listPosition;
        ownerList[pos] = ownerList[ownerList.length - 1];
        ownershipMap[ownerList[pos]].listPosition = pos;
        --ownerList.length;
    }

    // the ether produced by the asset(s) is sent by calling this function
    function payment(string info) external payable {
        treasuryBalance += (msg.value * treasuryRatio) / TREASURY_RATIO_DENOMINATOR;
        emit PAYMENT_RECEIVED(msg.sender, msg.value, info);
    }

    // checks if at least one payout period has passed, and if it did,
    // it divides the contract balance between the shareholders
    function payOwners() external {
        uint timeElapsed = block.timestamp - lastPayday;
        require(timeElapsed >= payoutPeriod, "There is still time until the next payday.");
        // account for multiple payout periods
        lastPayday = block.timestamp - (timeElapsed % payoutPeriod);
        divideAndTransferFunds();
        emit OWNERS_PAID();
    }

    // divides the contract balance between the treasury and the shareholders
    function divideAndTransferFunds() private {
        // funds accumulated since last division
        uint funds = getFunds();
        // send owners'offer gains
        for (uint i = 0; i != ownerList.length; ++i) {
            ownerList[i].send((funds * ownershipMap[ownerList[i]].shares) / TOTAL_SHARES);
        }
    }

    // a way to deposit money directly into the treasury
    function treasuryDeposit(string info) external payable {
        treasuryBalance += msg.value;
        emit TRESURY_DEPOSIT(msg.sender, msg.value, info);
    }

    // returns the amount of funds in the treasury
    function getTreasuryBalance() external view returns (uint) {
        return treasuryBalance;
    }

    // returns the amount of funds that will be split between shareholders upon the next payday
    function getFunds() public view returns (uint) {
        return address(this).balance - treasuryBalance;
    }


    function offerToBuy(uint shares, uint price, address receiver) external payable {
        require(shares > 0, "0-shares auctions are not allowed.");

        offerList.push(Offer(offerList.length, OfferType.BUY, activeOffersList.length, msg.sender,
            receiver, shares, price, block.timestamp, 0, false));

        uint buyOfferPosition = offerList.length - 1;
        activeOffersList.push(offerList.length - 1);
        uint flag = 0;
        for (uint i = 0; i < offerList.length; i++) {
            Offer storage sellOffer = offerList[i];
            if (sellOffer.listPosition != MISSING) {
                if (sellOffer.offerType == OfferType.SELL) {
                    if (sellOffer.shares >= shares) {
                        //TODO: get lowest price
                        //TODO: pay price for the amount of shares bought
                        if (flag == 0) {

                            flag = 1;

                            //seller is not the same as the one offering the buying
                            Offer storage buyOffer = offerList[buyOfferPosition];

                            require(sellOffer.listPosition != MISSING, "Offer is no longer active.");
                            require(sellOffer.buyer == address(0) || sellOffer.buyer == msg.sender, "Caller is not the intended buyer.");
                            //position of sell offer
                            uint offerId = sellOffer.id;

                            require(sellOffer.seller.send(msg.value), "Funds could not be forwarded. Transaction denied.");


                            // transfer shares
                            if (ownershipMap[msg.sender].shares == 0) {
                                addOwner(msg.sender, shares);
                            } else {
                                ownershipMap[msg.sender].shares += shares;
                            }
                            ownershipMap[sellOffer.seller].shares -= shares;
                            if (ownershipMap[sellOffer.seller].shares == 0) {
                                removeOwner(sellOffer.seller);
                            }

                            // complete offer
                            sellOffer.buyer = msg.sender;
                            sellOffer.completionDate = block.timestamp;

                            //change buy offer
                            if (shares == buyOffer.shares) {
                                // remove buy offer
                                //                        deactivateOffer(buyOfferPosition);
                            } else {
                                buyOffer.shares = buyOffer.shares - shares;
                                buyOffer.price = buyOffer.price - msg.value;
                            }

                            //if all shares are bought, delete offer
                            if (shares == sellOffer.shares) {
                                //remove sell offer
                                deactivateOffer(offerId);
                            } else {
                                //change sell offer
                                ownershipMap[sellOffer.seller].sharesOnSale -= shares;
                                sellOffer.buyer = address(0);
                                sellOffer.shares = sellOffer.shares - shares;
                                sellOffer.price = sellOffer.price - msg.value;

                            }
                        }
                    }
                }
            }
        }
        emit NEW_OFFER(offerList.length - 1);
    }


    // publishes a new SELL offer (transfer of shares from an owner to a buyer for a price)
    // use 0 for the receiver address to let anyone purchase the shares
    // set the price to 0 for gift
    function offerToSell(uint sharesAmount, uint price, address receiver) external {
        require(sharesAmount > 0, "0-shares auctions are not allowed.");
        require(sharesAmount + ownershipMap[msg.sender].sharesOnSale <= ownershipMap[msg.sender].shares,
            "Caller does not own this many shares.");

        // create new active SELL offer
        offerList.push(Offer(offerList.length, OfferType.SELL, activeOffersList.length, msg.sender,
            receiver, sharesAmount, price, block.timestamp, 0, false));
        activeOffersList.push(offerList.length - 1);

        // adjust seller's amount of shares on sale
        ownershipMap[msg.sender].sharesOnSale += sharesAmount;

        emit NEW_OFFER(offerList.length - 1);
    }

    // allows the caller to complete a SELL offer and performs the exchange of shares and ether
    // if any of the requirements fail, the transaction (including the transferred money) is reverted
    function buyShares(uint offerId, uint shares) external payable {
        require(offerId < offerList.length, "Invalid offer id.");
        Offer storage offer = offerList[offerId];

        require(shares > 0, "No shares");
        require(shares <= offer.shares, "more than offered shares");

        require(offer.offerType == OfferType.SELL, "Offer is not a sale.");
        require(offer.listPosition != MISSING, "Offer is no longer active.");

        require(offer.buyer == address(0) || offer.buyer == msg.sender, "Caller is not the intended buyer.");

        // require(msg.value == offer.price, "Caller did not transfer the exact payment amount.");

        // attempt to transfer funds to seller, revert if it fails
        require(offer.seller.send(msg.value), "Funds could not be forwarded. Transaction denied.");

        // transfer shares
        if (ownershipMap[msg.sender].shares == 0) {
            addOwner(msg.sender, shares);
        } else {
            ownershipMap[msg.sender].shares += shares;
        }
        ownershipMap[offer.seller].shares -= shares;
        if (ownershipMap[offer.seller].shares == 0) {
            removeOwner(offer.seller);
        }

        // complete offer
        offer.buyer = msg.sender;
        offer.completionDate = block.timestamp;

        //if all shares are bought, delete offer
        if (shares == offer.shares) {
            deactivateOffer(offerId);
        } else {
            offer.buyer = address(0);
            offer.shares = offer.shares - shares;
            offer.price = offer.price - msg.value;
            ownershipMap[offer.seller].sharesOnSale -= shares;
        }
        emit COMPLETED_OFFER(offerId);
    }

    // deactivates an active auction owned by the caller
    function cancelOffer(uint offerId) external {
        require(offerId < offerList.length, "Invalid offer id.");
        require(msg.sender == offerList[offerId].seller, "Caller does not own this offer.");
        require(offerList[offerId].listPosition != MISSING, "Offer is already inactive.");

        offerList[offerId].cancelled = true;
        deactivateOffer(offerId);
        emit CANCELLED_OFFER(offerId);
    }

    // removes an auction from the list of active auctions
    function deactivateOffer(uint offerId) private {
        Offer storage offer = offerList[offerId];

        if (offer.offerType == OfferType.SELL) {
            ownershipMap[offer.seller].sharesOnSale -= offer.shares;
        }

        uint pos = offer.listPosition;
        offer.listPosition = MISSING;
        activeOffersList[pos] = activeOffersList[activeOffersList.length - 1];
        offerList[activeOffersList[pos]].listPosition = pos;
        --activeOffersList.length;
    }

    function getActiveOffersCount() external view returns (uint) {
        return activeOffersList.length;
    }

    function getOffersCount() external view returns (uint) {
        return offerList.length;
    }

    function getActiveOfferByIndex(uint idx) external view returns (uint id,
        string offerType,
        address seller,
        address buyer,
        uint shares,
        uint price,
        uint creationDate,
        uint completionDate,
        bool cancelled) {
        return getOffer(activeOffersList[idx]);
    }

    function getOffer(uint offerId) public view returns (uint id,
        string offerType,
        address seller,
        address buyer,
        uint shares,
        uint price,
        uint creationDate,
        uint completionDate,
        bool cancelled) {
        Offer storage offer = offerList[offerId];
        id = offer.id;
        offerType = (offer.offerType == OfferType.SELL ? "SELL" : "BUY");
        seller = offer.seller;
        buyer = offer.buyer;
        shares = offer.shares;
        price = offer.price;
        creationDate = offer.creationDate;
        completionDate = offer.completionDate;
        cancelled = offer.cancelled;
    }
}
