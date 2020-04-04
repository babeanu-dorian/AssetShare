pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";

contract AssetShareApp is AragonApp {

    // Events
    event PAYMENT_RECEIVED(address sender, uint amount, string info);
    event TREASURY_DEPOSIT(address sender, uint amount, string info);
    event OWNERS_PAID();
    event NEW_OFFER(uint id);
    event CANCELLED_OFFER(uint id);
    event SHARES_TRANSFERED(address from, address to, uint sharesAmount, uint cost);

    struct Owner {                  // used to store shareholder information
        uint shares;                // amount of shares owned by shareholder
        uint sharesOnSale;          // amount of the owner's shares currently on sale
        uint listPosition;          // position in the ownerList
    }

    enum OfferType {
        SELL,
        BUY
    }

    struct Offer {                // describes an offer for selling / buying / gifting shares
        uint id;                  // offer id (index in the offerList.txt)
        OfferType offerType;      // the type of the offer (BUY or SELL)
        uint listPosition;        // position in the activeOffersList (MISSING if not active)
        address seller;           // address of the (intended) seller (empty for public auction)
        address buyer;            // address of the (intended) buyer (empty for public auction)
        uint shares;              // amount of shares ofered
        uint price;               // price of one share in wei (set to 0 for gift)
        uint creationDate;        // unix timestamp of the date when the offer was published
        uint completionDate;      // unix timestamp of the date when the shares were transferred or the offer was cancelled
        bool cancelled;           // whether or not the offer was cancelled
    }

    uint constant public MISSING = ~uint256(0);                  // max uint value, signals missing data
    uint constant public TOTAL_SHARES = 1000000;                 // total number of ownership shares
    uint constant public TREASURY_RATIO_DENOMINATOR              // the ratio of ether placed in the treasury
                                      = TOTAL_SHARES;            // = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR

    uint constant private DEFAULT_TREASURY_RATIO                 // default value of treasuryRatio
                                      = TREASURY_RATIO_DENOMINATOR / 10;
    uint constant private DEFAULT_PAYOUT_PERIOD = 60;            // default value of payoutPeriod

    string private assetDescription;                             // textual description of the asset

    address[] private ownerList;                                 // list of owner addresses
    mapping(address => Owner) private ownershipMap;              // maps each address to its respective owner information

    uint private treasuryBalance;               // wei in the treasury
    uint private treasuryRatio;                 // the ratio of ether placed in the treasury
                                                //     = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR
    uint private funds;                         // amount to be split between owners (in wei)
    uint private payoutPeriod;                  // time interval between shareholder payout (in seconds)
    uint private lastPayday;                    // unix timestamp of last theoretical* payout
                                                //     *Time when the payout should have happened

    Offer[] private offerList;                  // list of all offers
    uint[] private activeOffersList;            // list of indexes of active offers

    function initialize() public onlyInit {

        // TODO: pass this in as parameter
        address initialOwner = address(0xb4124cEB3451635DAcedd11767f004d8a28c6eE7);

        // contract creator starts as sole owner
        addOwner(initialOwner, TOTAL_SHARES);

        // set default values
        treasuryBalance = 0;
        treasuryRatio = DEFAULT_TREASURY_RATIO;
        funds = 0;
        payoutPeriod = DEFAULT_PAYOUT_PERIOD;
        lastPayday = block.timestamp;

        initialized();
    }

    function getAssetDescription() external view returns (string) {
        return assetDescription;
    }

    function getSharesByAddress(address owner) external view returns (uint) {
        return ownershipMap[owner].shares;
    }

    function getSharesOnSaleByAddress(address owner) external view returns (uint) {
        return ownershipMap[owner].sharesOnSale;
    }

    function getOwnersCount() external view returns (uint) {
        return ownerList.length;
    }

    function getOwnerAddressByIndex(uint idx) external view returns (address) {
        require(idx < ownerList.length, "Invalid owner index.");
        return ownerList[idx];
    }

    // increase the amount of shares for a given address;
    // if that address was not previously an owner, it becomes one;
    // proposal support is adjusted based on new amount of shares
    function increaseShares(address ownerAddress, uint amount) private {
        Owner storage owner = ownershipMap[ownerAddress];
        if (owner.shares == 0) {
            addOwner(ownerAddress, amount);
        } else {
            owner.shares += amount;
        }
    }

    // decrease the amount of shares for a given owner;
    // if the owner is left without shares, they are removed from the list of owners;
    // proposal support is adjusted based on new amount of shares
    function decreaseShares(address ownerAddress, uint amount) private {
        Owner storage owner = ownershipMap[ownerAddress];
        owner.shares -= amount;
        if (owner.shares == 0) {
            removeOwner(ownerAddress);
        }
    }

    // transfers shares from one account to another
    function transferShares(address from, address to, uint sharesAmount) private {
        decreaseShares(from, sharesAmount);
        increaseShares(to, sharesAmount);
    }

    // creates a new owner
    function addOwner(address ownerAddress, uint shares) private {
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
        uint amountForTreasury = (msg.value * treasuryRatio) / TREASURY_RATIO_DENOMINATOR;
        funds = msg.value - amountForTreasury;
        treasuryBalance += amountForTreasury;
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
        uint amount;
        for (uint i = 0; i != ownerList.length; ++i) {
            amount = (funds * ownershipMap[ownerList[i]].shares) / TOTAL_SHARES;
            require(ownerList[i].send(amount), "Funds could not be forwarded. Transaction denied.");
            funds -= amount; // contract will leak money if you just set funds to 0
        }
    }

    // a way to deposit money directly into the treasury
    function treasuryDeposit(string info) external payable {
        treasuryBalance += msg.value;
        emit TREASURY_DEPOSIT(msg.sender, msg.value, info);
    }

    // returns the amount of funds in the treasury
    function getTreasuryBalance() external view returns (uint) {
        return treasuryBalance;
    }

    function getTreasuryRatio() external view returns (uint) {
        return treasuryRatio;
    }

    // returns the amount of funds that will be split between shareholders upon the next payday
    function getFunds() public view returns (uint) {
        return funds;
    }

    function getPayoutPeriod() public view returns (uint) {
        return payoutPeriod;
    }

    // publishes a new SELL offer (transfer of shares from an owner to a buyer for a price)
    // use 0 for the intendedBuyer address to let anyone purchase the shares
    // set the price to 0 for gift
    function offerToSell(uint sharesAmount, uint price, address intendedBuyer) external {

        require(sharesAmount > 0, "0-shares auctions are not allowed.");

        require(sharesAmount  + ownershipMap[msg.sender].sharesOnSale <= ownershipMap[msg.sender].shares,
            "Caller does not own this many shares.");

        // create new active SELL offer
        uint id = offerList.length;
        offerList.push(Offer(id, OfferType.SELL, activeOffersList.length, msg.sender,
                             intendedBuyer, sharesAmount, price, block.timestamp, 0, false));
        activeOffersList.push(id);

        // adjust seller's amount of shares on sale
        ownershipMap[msg.sender].sharesOnSale += sharesAmount;

        emit NEW_OFFER(id);
    }

    // publish a new BUY offer (request for an owner to transfer shares to the caller for a price)
    // the caller will deposit the total cost of the shares in the contract balance
    // these funds will be transfered to the sellers, or back to the offer author upon cancellation
    // use 0 for the intendedSeller to let any owner sell shares
    // set the price to 0 to request gift
    function offerToBuy(uint sharesAmount, uint price, address intendedSeller) external payable {

        require(sharesAmount > 0, "0-shares auctions are not allowed.");

        require(msg.value == sharesAmount * price, "Caller must deposit the exact total cost of the transaction.");

        // create new active BUY offer
        uint id = offerList.length;
        offerList.push(Offer(id, OfferType.BUY, activeOffersList.length, intendedSeller,
                             msg.sender, sharesAmount, price, block.timestamp, 0, false));
        activeOffersList.push(id);

        emit NEW_OFFER(id);
    }

    // allows the caller to (partially) complete a SELL offer and performs the exchange of shares and ether
    // if any requirement fails, the transaction (including the transferred money) is reverted
    function buyShares(uint offerId, uint sharesAmount) external payable {
        require(offerId < offerList.length, "Invalid offer id.");

        Offer storage offer = offerList[offerId];

        require(offer.offerType == OfferType.SELL, "Offer is not a sale.");

        require(offer.listPosition != MISSING, "Offer is no longer active.");

        require(offer.buyer == address(0) || offer.buyer == msg.sender, "Caller is not the intended buyer.");

        require(offer.shares >= sharesAmount, "The offer contains less shares than requested.");

        require(msg.value == sharesAmount * offer.price, "Caller did not transfer the exact payment amount.");

        // attempt to transfer funds to seller, revert if it fails
        require(offer.seller.send(msg.value), "Funds could not be forwarded. Transaction denied.");

        transferShares(offer.seller, msg.sender, sharesAmount);

        // adjust seller's shares on sale
        ownershipMap[offer.seller].sharesOnSale -= sharesAmount;

        // adjust amount of shares in offer
        decreaseSharesInOffer(offer, sharesAmount);
        
        emit SHARES_TRANSFERED(offer.seller, msg.sender, sharesAmount, msg.value);
    }

    // allows the caller to (partially) complete a BUY offer and performs the exchange of shares and ether
    // if any requirement fails, the transaction (including the transferred money) is reverted
    function sellShares(uint offerId, uint sharesAmount) external {
        require(offerId < offerList.length, "Invalid offer id.");

        Offer storage offer = offerList[offerId];

        require(offer.offerType == OfferType.BUY, "Offer is not a buy offer.");

        require(offer.listPosition != MISSING, "Offer is no longer active.");

        require(offer.seller == address(0) || offer.seller == msg.sender, "Caller is not the intended seller.");

        require(offer.shares >= sharesAmount, "The offer contains less shares than requested.");

        require(sharesAmount + ownershipMap[msg.sender].sharesOnSale <= ownershipMap[msg.sender].shares,
            "Caller does not own this many shares.");

        uint earnings = sharesAmount * offer.price;

        // attempt to transfer funds to seller, revert if it fails
        require(msg.sender.send(earnings), "Funds could not be forwarded. Transaction denied.");

        transferShares(msg.sender, offer.buyer, sharesAmount);

        // adjust amount of shares in offer
        decreaseSharesInOffer(offer, sharesAmount);
        
        emit SHARES_TRANSFERED(msg.sender, offer.buyer, sharesAmount, earnings);
    }

    // allows the merging of a buying offer with a selling offer and performs the exchange of shares and ether
    // the caller must be the owner of one of the offers
    // the amount of ether offered by the buyer must be equal or higher to the amount requested by the seller
    // the intended buyer / seller must be 0 or match the actual buyer / seller
    // the maximum amount of shares will be transferred, so at least one of the offers will be completed
    // the caller gets the better deal:
    //    - if the caller is the seller, they receive the full amount offered by the buyer
    //    - if the caller is the buyer, they pay what the seller asked for and keep the difference
    function combineOffers(uint sellOfferId, uint buyOfferId) external {

        require(sellOfferId < offerList.length, "Invalid sell offer id.");
        require(buyOfferId < offerList.length, "Invalid buy offer id.");

        Offer storage sellOffer = offerList[sellOfferId];
        Offer storage buyOffer = offerList[buyOfferId];

        require(sellOffer.offerType == OfferType.SELL, "Sell offer is not a sell offer.");
        require(buyOffer.offerType == OfferType.BUY, "Buy offer is not a buy offer.");

        require(sellOffer.listPosition != MISSING, "Sell offer is no longer active.");
        require(buyOffer.listPosition != MISSING, "Buy offer is no longer active.");

        require(sellOffer.buyer == address(0) || sellOffer.buyer == buyOffer.buyer, "Buyer is not the intended buyer.");
        require(buyOffer.seller == address(0) || buyOffer.seller == sellOffer.seller, "Seller is not the intended seller.");

        require(sellOffer.price <= buyOffer.price,
            "The amount of ether offered by the buyer must be equal or higher to the amount requested by the seller");

        uint sharesAmount = (sellOffer.shares < buyOffer.shares ? sellOffer.shares : buyOffer.shares);
        uint sellerRevenue;

        if (msg.sender == sellOffer.seller) {
            sellerRevenue = sharesAmount * buyOffer.price;
        } else if (msg.sender == buyOffer.buyer) {
            sellerRevenue = sharesAmount * sellOffer.price;
            // refund the buyer the difference
            require(msg.sender.send(sharesAmount * (buyOffer.price - sellOffer.price)),
                "Funds could not be forwarded. Transaction denied.");
        } else {
            require(false, "Caller does not own either offer.");
        }

        // pay seller
        require(sellOffer.seller.send(sellerRevenue), "Funds could not be forwarded. Transaction denied.");

        transferShares(sellOffer.seller, buyOffer.buyer, sharesAmount);

        // adjust seller's shares on sale
        ownershipMap[sellOffer.seller].sharesOnSale -= sharesAmount;

        // adjust amount of shares in offers
        decreaseSharesInOffer(sellOffer, sharesAmount);
        decreaseSharesInOffer(buyOffer, sharesAmount);

        emit SHARES_TRANSFERED(sellOffer.seller, buyOffer.buyer, sharesAmount, sellerRevenue);
    }

    function decreaseSharesInOffer(Offer storage offer, uint sharesAmount) private {
        offer.shares -= sharesAmount;

        // deactivate completed offers
        if (offer.shares == 0) {
            deactivateOffer(offer);
        }
    }

    // deactivates an active auction owned by the caller
    function cancelOffer(uint offerId) external {
        require(offerId < offerList.length, "Invalid offer id.");

        Offer storage offer = offerList[offerId];

        require(offer.listPosition != MISSING, "Offer is already inactive.");

        if (offer.offerType == OfferType.SELL) {
            require(msg.sender == offer.seller, "Caller does not own this offer.");
            ownershipMap[msg.sender].sharesOnSale -= offer.shares;
        } else { // OfferType.BUY
            require(msg.sender == offer.buyer, "Caller does not own this offer.");

            // refund buyer for shares not purchased
            require(msg.sender.send(offer.shares * offer.price),
                "Funds could not be forwarded. Transaction denied.");
        }

        offer.cancelled = true;
        deactivateOffer(offer);
        emit CANCELLED_OFFER(offerId);
    }

    // removes an offer from the list of active offers
    function deactivateOffer(Offer storage offer) private {
        offer.completionDate = block.timestamp;

        uint pos = offer.listPosition;
        activeOffersList[pos] = activeOffersList[activeOffersList.length - 1];
        offerList[activeOffersList[pos]].listPosition = pos;
        offer.listPosition = MISSING;
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
        require(idx < activeOffersList.length, "Invalid active offer index.");
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
        require(offerId < offerList.length, "Invalid offer id.");
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