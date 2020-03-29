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
        uint id;                  // offer id (index in the offerList)
        OfferType offerType;      // the type of the offer (BUY or SELL)
        uint listPosition;        // position in the activeBuyOffersList or activeSellOffersList (MISSING if not active)
        address creator;          // address of the creator of the offer
        uint shares;              // initial amount of offered shares
        uint sharesRemaining;     // amount of offered shares remaining for sale/buy
        uint price;               // price per share in wei (set to 0 for gift)
        uint weiAmount;           // amount of wei remaining for buying offers or obtained for sell offers
        uint creationDate;        // unix timestamp of the date when the offer was published
        uint completionDate;      // unix timestamp of the date when the shares were transfered or the offer was cancelled
        bool cancelled;           // whether or not the offer was cancelled (or collected, if the offer was completed)
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
    uint[] private activeBuyOffersList;         // list of indexes of active buy offers, ordered from lowest to highest offer.
    uint[] private activeSellOffersList;        // list of indexes of active sell offers, ordered from highest to lowest offer.

    uint public flag;

    function initialize() public onlyInit {

        address initialOwner = address(0xb4124cEB3451635DAcedd11767f004d8a28c6eE7);

        // contract creator starts as sole owner
        addOwner(initialOwner, TOTAL_SHARES);

        // set default values
        treasuryBalance = 0;
        treasuryRatio = DEFAULT_TREASURY_RATIO;
        payoutPeriod = DEFAULT_PAYOUT_PERIOD;
        lastPayday = block.timestamp;
        flag = 1;
        initialized();

    }

    function getSharesByAddress(address owner) external view returns (uint) {
        return ownershipMap[owner].shares;
    }

    function getShares() external view returns (uint) {
        return ownershipMap[msg.sender].shares;
    }

    function getSharesOnSaleByAddress(address owner) external view returns (uint) {
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
            require(ownerList[i].send((funds * ownershipMap[ownerList[i]].shares) / TOTAL_SHARES), "Failed to divide and transfer funds.");
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

    // Creates a buy offer for the given amount of shares for the given price.
    // If the offer auto completes using existing sell offers, then it will already be deactivated and ready to be collected.
    // The new offer is appended at the end of the offerList.
    function offerToBuy(uint numShares, uint price) external payable {
        require(numShares > 0, "0-shares auctions are not allowed.");

        // Require the caller to send exactly the funds required to buy all shares at the supplied (maximum) price.
        uint maxPrice = numShares * price; // TODO - Protect against integer overflow in weiAmount.
        require(msg.value >= maxPrice, "Insufficient funds.");
        require(msg.value == maxPrice, "Mismatch between max price and paid amount."); // Disallow too large payments since we'd have to send them back.

        // Create the new buy offer and add it to the offers list.
        offerList.push(Offer(offerList.length, OfferType.BUY, MISSING,
                msg.sender, numShares, numShares, price, maxPrice, block.timestamp, 0, false));
        Offer storage buyOffer = offerList[offerList.length - 1];

        // Attempt to autocomplete the offer.
        for (uint i = 1; i <= activeSellOffersList.length; i++) {
            Offer storage sellOffer = offerList[activeSellOffersList[activeSellOffersList.length - i]];

            // Break if the price for this sell offer (and therefore all following sell offers) is higher than the offered price.
            if (price < sellOffer.price) {
                break;
            }

            // Fully or partially complete this sell offer.
            uint numTransShares;
            uint weiAmount;
            if (buyOffer.sharesRemaining >= sellOffer.sharesRemaining) { // Fully complete this sell offer.
                flag++;
                // Transfer the shares.
                numTransShares = sellOffer.sharesRemaining;
                sellOffer.sharesRemaining = 0;
                buyOffer.sharesRemaining -= numTransShares;
                ownershipMap[sellOffer.creator].sharesOnSale -= numTransShares;
                transferShares(sellOffer.creator, buyOffer.creator, numTransShares);

                // Update the transaction values.
                weiAmount = numTransShares * sellOffer.price;
                sellOffer.weiAmount += weiAmount;
                buyOffer.weiAmount -= weiAmount;

                // Set completion timestamp.
                sellOffer.completionDate = block.timestamp;

                // Remove the completed sell offer.
                removeActiveOffer(sellOffer);

                // TODO - Implement somewhere that the seller can now cancel their completed offer to obtain the wei from the contract, even if they are no longer an owner.
                //        This should happen when the offer is cancelled (boolean cancelled), such that the payout can only happen once.

                // Break if this has fully completed the buy offer.
                if (buyOffer.sharesRemaining == 0) {
                    break;
                }
            } else { // Partially complete this sell offer.

                // Transfer the shares.
                numTransShares = buyOffer.sharesRemaining;
                sellOffer.sharesRemaining -= numTransShares;
                buyOffer.sharesRemaining = 0;
                ownershipMap[sellOffer.creator].sharesOnSale -= numTransShares;
                transferShares(sellOffer.creator, buyOffer.creator, numTransShares);

                // Update the transaction values.
                weiAmount = numTransShares * sellOffer.price;
                sellOffer.weiAmount += weiAmount;
                buyOffer.weiAmount -= weiAmount;

                // Break since the buy offer has been fully completed.
                break;
            }
        }

        // Add the buy offer to the list of active offers if it hasn't been fully auto completed, keeping it ordered from lowest to highest buy offer.
        if (buyOffer.sharesRemaining > 0) {
            uint newOfferInd = activeBuyOffersList.length;
            activeBuyOffersList.push(0); // Append placeholder.
            for (uint j = 2; j <= activeBuyOffersList.length; j++) {
                uint ind = activeBuyOffersList.length - j;

                // Break if the new offer should be inserted before the offer at index ind.
                if(price > offerList[activeBuyOffersList[ind]].price) {
                    break;
                }

                // Move the offer at index ind if the new offer should be inserted before it.
                activeBuyOffersList[ind + 1] = activeBuyOffersList[ind];
                newOfferInd = ind;
            }
            buyOffer.listPosition = newOfferInd;
            activeBuyOffersList[newOfferInd] = buyOffer.id;
        } else {

            // The buy offer was auto completed, so mark it as such.
            buyOffer.completionDate = block.timestamp;
        }

        // TODO - Move this to where the buy offer is 'cancelled' (collected).
        // Require the caller to pay the required funds to the contract, for auto completed offers and potentially to reserve for automatically completing selling offers later.
        // Return excessive payment to the caller.
//        uint requiredPayment = buyOffer.sharesRemaining * buyOffer.price        // Payment required for remaining buy offer.
//                + (buyOffer.shares * buyOffer.price) - buyOffer.priceRemaining; // Payment spent during auto completion.
//        require(sender.value >= requiredPayment, "Insufficient funds.");
//        if(sender.value > requiredPayment) {
//            require(msg.sender.send(sender.value - requiredPayment));
//        }

        // Emit a new offer event.
        emit NEW_OFFER(buyOffer.id);
    }

    // Creates a sell offer for the given amount of shares for the given price.
    // If the offer auto completes using existing buy offers, then it will already be deactivated and ready to be collected.
    // The new offer is appended at the end of the offerList.
    function offerToSell(uint numShares, uint price) external {
        require(numShares > 0, "0-shares auctions are not allowed.");

        // Require the caller to have enough shares to put up for sale.
        require(ownershipMap[msg.sender].shares - ownershipMap[msg.sender].sharesOnSale > numShares,
            "Caller does not own this many shares.");

        // Adjust seller's amount of shares on sale.
        ownershipMap[msg.sender].sharesOnSale += numShares;

        // Create the new sell offer and add it to the offers list.
        offerList.push(Offer(offerList.length, OfferType.SELL, MISSING,
                msg.sender, numShares, numShares, price, 0, block.timestamp, 0, false));
        Offer storage sellOffer = offerList[offerList.length - 1];

        // Attempt to autocomplete the offer.
        for (uint i = 1; i <= activeBuyOffersList.length; i++) {
            Offer storage buyOffer = offerList[activeBuyOffersList[activeBuyOffersList.length - i]];

            // Break if the price for this buy offer (and therefore all following sell offers) is lower than the asked price.
            if (price > buyOffer.price) {
                break;
            }

            // Fully or partially complete this buy offer.
            uint numTransShares;
            uint weiAmount;
            if (sellOffer.sharesRemaining >= buyOffer.sharesRemaining) { // Fully complete this buy offer.

                // Transfer the shares.
                numTransShares = buyOffer.sharesRemaining;
                buyOffer.sharesRemaining = 0;
                sellOffer.sharesRemaining -= numTransShares;
                ownershipMap[sellOffer.creator].sharesOnSale -= numTransShares;
                transferShares(sellOffer.creator, buyOffer.creator, numTransShares);

                // Update the transaction values.
                weiAmount = numTransShares * buyOffer.price;
                sellOffer.weiAmount += weiAmount;
                buyOffer.weiAmount -= weiAmount;

                // Set completion timestamp.
                buyOffer.completionDate = block.timestamp;

                // Remove the completed buy offer.
                removeActiveOffer(buyOffer);

                // TODO - Implement somewhere that the buyer can now cancel their completed offer to obtain the shares from the contract, even if they are not yet an owner.
                //        This should happen when the offer is cancelled (boolean cancelled), such that the shares payout can only happen once.

                // Break if this has fully completed the sell offer.
                if (sellOffer.sharesRemaining == 0) {
                    break;
                }
            } else { // Partially complete this buy offer.

                // Transfer the shares.
                numTransShares = sellOffer.sharesRemaining;
                buyOffer.sharesRemaining -= numTransShares;
                sellOffer.sharesRemaining = 0;
                ownershipMap[sellOffer.creator].sharesOnSale -= numTransShares;
                transferShares(sellOffer.creator, buyOffer.creator, numTransShares);

                // Update the transaction values.
                weiAmount = numTransShares * buyOffer.price;
                sellOffer.weiAmount += weiAmount;
                buyOffer.weiAmount -= weiAmount;

                // Break since the sell offer has been fully completed.
                break;
            }
        }

        // Add the sell offer to the list of active offers if it hasn't been fully auto completed, keeping it ordered from highest to lowest sell offer.
        if (sellOffer.sharesRemaining > 0) {
            uint newOfferInd = activeSellOffersList.length;
            activeSellOffersList.push(0); // Append placeholder.
            for (uint j = 2; j <= activeSellOffersList.length; j++) {
                uint ind = activeSellOffersList.length - j;

                // Break if the new offer should be inserted before the offer at index ind.
                if(price < offerList[activeSellOffersList[ind]].price) {
                    break;
                }

                // Move the offer at index ind if the new offer should be inserted before it.
                activeSellOffersList[ind + 1] = activeSellOffersList[ind];
                newOfferInd = ind;
            }
            sellOffer.listPosition = newOfferInd;
            activeSellOffersList[newOfferInd] = sellOffer.id;
        } else {

            // The sell offer was auto completed, so mark it as such.
            sellOffer.completionDate = block.timestamp;
        }

        // Emit a new offer event.
        emit NEW_OFFER(sellOffer.id);
    }

    // Transfers shares from 'fromAddr' to 'toAddr'. Adds 'toAddr' as an owner if they had 0 shares, removes 'fromAddr' as an owner if they now have 0 shares.
    // This function does not validate whether the numbers of shares can actually be transferred or whether 'fromAddr' actually is an owner, so use with caution.
    function transferShares(address fromAddr, address toAddr, uint numShares) private {
        if (ownershipMap[toAddr].shares == 0) {
            addOwner(toAddr, numShares);
        } else {
            ownershipMap[toAddr].shares += numShares;
        }
        ownershipMap[fromAddr].shares -= numShares;
        if (ownershipMap[fromAddr].shares == 0) {
            removeOwner(fromAddr);
        }
    }

    // TODO - Remove if no longer needed, or update when we do want specific-offer-completion support.
//    // allows the caller to complete a SELL offer and performs the exchange of shares and ether
//    // if any of the requirements fail, the transaction (including the transferred money) is reverted
//    function buyShares(uint offerId, uint shares) external payable {
//        require(offerId < offerList.length, "Invalid offer id.");
//        Offer storage offer = offerList[offerId];
//
//        require(shares > 0, "No shares");
//        require(shares <= offer.shares, "more than offered shares");
//
//        require(offer.offerType == OfferType.SELL, "Offer is not a sale.");
//        require(offer.listPosition != MISSING, "Offer is no longer active.");
//
//        require(offer.buyer == address(0) || offer.buyer == msg.sender, "Caller is not the intended buyer.");
//
//        // require(msg.value == offer.price, "Caller did not transfer the exact payment amount.");
//
//        // attempt to transfer funds to seller, revert if it fails
//        require(offer.creator.send(msg.value), "Funds could not be forwarded. Transaction denied.");
//
//        // transfer shares
//        if (ownershipMap[msg.sender].shares == 0) {
//            addOwner(msg.sender, shares);
//        } else {
//            ownershipMap[msg.sender].shares += shares;
//        }
//        ownershipMap[offer.creator].shares -= shares;
//        if (ownershipMap[offer.creator].shares == 0) {
//            removeOwner(offer.creator);
//        }
//
//        // complete offer
//        offer.buyer = msg.sender;
//        offer.completionDate = block.timestamp;
//
//        //if all shares are bought, delete offer
//        if (shares == offer.shares) {
//            deactivateOffer(offerId);
//        } else {
//            offer.buyer = address(0);
//            offer.shares = offer.shares - shares;
//            offer.price = offer.price - msg.value;
//            ownershipMap[offer.creator].sharesOnSale -= shares;
//        }
//        emit COMPLETED_OFFER(offerId);
//    }

    // Deactivates the offer if it was active and pays out the wei that is stored in this offer.
    // Can only be called by the creator of this offer.
    // TODO - Move shares transfer to this function, rather than sending them to a user directly on buy? Offers do hold money now, but shares are immediately transferred.
    function collectOffer(uint offerId) external {
        require(offerId < offerList.length, "Invalid offer id.");
        Offer storage offer = offerList[offerId];
        require(msg.sender == offer.creator, "Caller is not the creator of this offer.");
        require(!offer.cancelled, "Offer is already collected.");

        // Mark the offer as collected.
        offer.cancelled = true;

        // Send the remaining or obtained wei to the offer creator.
        if (offer.weiAmount > 0) {
            require(offer.creator.send(offer.weiAmount), "Failed to pay out money from an offer.");
        }

        // Get the correct active offers list.
        uint[] activeOffersList;
        if (offer.offerType == OfferType.SELL) {
            activeOffersList = activeSellOffersList;

            // Mark the remaining shares for a sell offer as freed.
            ownershipMap[offer.creator].sharesOnSale -= offer.sharesRemaining;
        } else { // if (offer.offerType == OfferType.BUY)
            activeOffersList = activeBuyOffersList;
        }

        // Remove the offer from the active offer list if it was in it.
        if (offer.listPosition != MISSING) {
            for (uint i = offer.listPosition; i + 1 < activeOffersList.length; i++) {
                activeOffersList[i] = activeOffersList[i + 1];
            }
            --activeOffersList.length;
            offer.listPosition = MISSING;
        }

        // Emit an offer collected event.
        emit CANCELLED_OFFER(offerId);
    }

    // deactivates an active auction owned by the caller
    function cancelOffer(uint offerId) external {
        require(offerId < offerList.length, "Invalid offer id.");
        require(msg.sender == offerList[offerId].creator, "Caller does not own this offer.");
        require(offerList[offerId].listPosition != MISSING, "Offer is already inactive.");

        offerList[offerId].cancelled = true;
        deactivateOffer(offerId);
        emit CANCELLED_OFFER(offerId);
    }

    // Removes an active offer from the active offers list.
    function removeActiveOffer(Offer offer) private {
        uint[] activeOffersList;
        if (offer.offerType == OfferType.SELL) {
            activeOffersList = activeSellOffersList;
        } else { // if (offer.offerType == OfferType.BUY)
            activeOffersList = activeBuyOffersList;
        }
        uint offerIndex = offer.listPosition;
        offer.listPosition = MISSING;
        activeOffersList[offerIndex] = activeOffersList[activeOffersList.length - 1];
        offerList[activeOffersList[offerIndex]].listPosition = offerIndex;
        --activeOffersList.length;
    }

    // removes an auction from the list of active auctions
    function deactivateOffer(uint offerId) private {
        Offer storage offer = offerList[offerId];

        uint[] activeOffersList;
        if (offer.offerType == OfferType.SELL) {
            ownershipMap[offer.creator].sharesOnSale -= offer.shares;
            activeOffersList = activeSellOffersList;
        } else { // if (offer.offerType == OfferType.BUY)
            activeOffersList = activeBuyOffersList;
        }

        if (offer.listPosition != MISSING) {
            uint pos = offer.listPosition;
            offer.listPosition = MISSING;
            activeOffersList[pos] = activeOffersList[activeOffersList.length - 1];
            offerList[activeOffersList[pos]].listPosition = pos;
            --activeOffersList.length;
        }
    }

    function getActiveBuyOffersCount() external view returns (uint) {
        return activeBuyOffersList.length;
    }

    function getActiveSellOffersCount() external view returns (uint) {
        return activeSellOffersList.length;
    }

    function getOffersCount() external view returns (uint) {
        return offerList.length;
    }

    // Gets the id of the last added offer.
    function getLatestOfferId() external view returns (uint) {
        return offerList.length - 1;
    }

    // TODO - Update these getters with the new Offer fields (all getters below).
    function getActiveSellOfferByIndex(uint idx) external view returns (
            uint id,
            string offerType,
            address creator,
            uint shares,
            uint sharesRemaining,
            uint price,
            uint weiAmount,
            uint creationDate,
            uint completionDate,
            bool cancelled) {
        return getOffer(activeSellOffersList[idx]);
    }

    function getActiveBuyOfferByIndex(uint idx) external view returns (
            uint id,
            string offerType,
            address creator,
            uint shares,
            uint sharesRemaining,
            uint price,
            uint weiAmount,
            uint creationDate,
            uint completionDate,
            bool cancelled) {
        return getOffer(activeBuyOffersList[idx]);
    }

    function getOffer(uint offerId) public view returns (
            uint id,
            string offerType,
            address creator,
            uint shares,
            uint sharesRemaining,
            uint price,
            uint weiAmount,
            uint creationDate,
            uint completionDate,
            bool cancelled) {
        Offer storage offer = offerList[offerId];
        id = offer.id;
        offerType = (offer.offerType == OfferType.SELL ? "SELL" : "BUY");
        creator = offer.creator;
        shares = offer.shares;
        sharesRemaining = offer.sharesRemaining;
        price = offer.price;
        weiAmount = offer.weiAmount;
        creationDate = offer.creationDate;
        completionDate = offer.completionDate;
        cancelled = offer.cancelled;
    }
}
