pragma solidity 0.4.24;

contract SharedAsset {

    // Events
    event PAYMENT_RECEIVED(address sender, uint amount, string info);
    event TREASURY_DEPOSIT(address sender, uint amount, string info);
    event OWNERS_PAID();
    event NEW_OFFER(uint id);
    event CANCELLED_OFFER(uint id);
    event SHARES_TRANSFERED(address from, address to, uint sharesAmount, uint cost);
    event NEW_PROPOSAL(uint id);
    event EXECUTED_PROPOSAL(uint id);
    event CANCELLED_PROPOSAL(uint id);
    event REMOVED_SUPPORTED_PROPOSAL(uint idx);
    event VOTE(address voter, uint propId, bool vote);

    struct DataPoint {
        uint data;
        uint timestamp;
    }

    struct Owner {                  // used to store shareholder information
        uint shares;                // amount of shares owned by shareholder
        uint sharesOnSale;          // amount of the owner's shares currently on sale
        uint listPosition;          // position in the ownerList
        uint[] supportedProposals;  // list of ids of proposals currently supported
        uint lastKnownPayout;
        uint pendingPayout;
        mapping(uint => DataPoint) sharesHistory;
        uint sharesHistorySize;
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

    enum TaskFunction {                  // describes specific functions that can be used with tasks
        CHANGE_APPROVAL_TRESHOLD,        // edit the value of proposalApprovalThreshold
        CHANGE_ASSET_DESCRIPTION,        // edit the value of assetDescription
        CHANGE_TREASURY_RATIO,           // edit the value of treasuryRatio
        EXECUTE_EXTERNAL_CONTRACT,       // execute a function on an external contract (may use treasury funds)
        ORIGINAL,                        // free format proposal
        SEND_MONEY                       // send money from the treasury to an address
    }

    struct Task {                        // describes some executable instructions
        TaskFunction functionId;         // determines which function is called
        uint uintArg;                    // uint argument to be passed to the function
        string stringArg;                // string argument to be passed to the function
        address addressArg;              // address argument to be passed to the function
    }

    struct Proposal {                          // describes a proposal for changing the configurations of
                                               //     this contract, or for executing an external contract
        uint id;                               // proposal id
        address owner;                         // address of the owner who made the proposal
        uint listPosition;                     // index in the activeProposalList
                                               //     (MISSING if not active)
        string reason;                         // reasons provided for the change
        Task task;                             // instructions to execute if the proposal is approved
        uint support;                          // total amount of shares voting 'yes'
        mapping(address => uint) supportMap;   // amount of shares pledged by each owner
        mapping(address => uint) positionMap;  // proposal position in the supportedProposals list of each owner
        uint creationDate;                     // unix timestamp of the date when the proposal was made
        uint expirationDate;                   // unix timestamp of the date when the proposal expires
        uint completionDate;                   // unix timestamp of the date when the proposal was approved
        bool cancelled;                        // whether or not the proposal was cancelled
    }

    uint constant public MISSING = ~uint256(0);                  // max uint value, signals missing data
    uint constant public TOTAL_SHARES = 1000000;                 // total number of ownership shares
    uint constant public TREASURY_RATIO_DENOMINATOR              // the ratio of ether placed in the treasury
                                      = TOTAL_SHARES;            // = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR

    uint constant private DEFAULT_TREASURY_RATIO                 // default value of treasuryRatio
                                      = TREASURY_RATIO_DENOMINATOR / 10;
    uint constant private DEFAULT_APPROVAL_TRESHOLD              // default value of proposalApprovalThreshold
                                      = TOTAL_SHARES / 2 + 1;

    string private assetDescription;                             // textual description of the asset

    address[] private ownerList;                                 // list of owner addresses
    mapping(address => Owner) private ownershipMap;              // maps each address to its respective owner information

    uint private treasuryBalance;               // wei in the treasury
    uint private treasuryRatio;                 // the ratio of ether placed in the treasury
                                                //     = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR
    uint private totalPayout;
    DataPoint[] payoutHistory;

    Offer[] private offerList;                  // list of all offers
    uint[] private activeOffersList;            // list of indexes of active offers

    Proposal[] proposalList;                    // list of all proposals
    uint[] private activeProposalsList;         // list of id's of ongoing proposals
    uint private proposalApprovalThreshold;     // amount of votes required to approve a proposal

    constructor(address initialOwner, string description) public {

        // TODO: pass this in as parameter
        // address initialOwner = address(0xb4124cEB3451635DAcedd11767f004d8a28c6eE7);

        // contract creator starts as sole owner
        addOwner(initialOwner, TOTAL_SHARES);
        assetDescription = description;

        // set default values
        treasuryBalance = 0;
        treasuryRatio = DEFAULT_TREASURY_RATIO;
        proposalApprovalThreshold = DEFAULT_APPROVAL_TRESHOLD;
    }

    function getAssetDescription() external view returns (string) {
        return assetDescription;
    }

    //*****************************OWNERS****************************************************

    function requireOwner(string errorMsg) private view {
        require(ownershipMap[msg.sender].shares > 0, errorMsg);
    }

    function getSharesByAddress(address owner) external view returns (uint) {
        return ownershipMap[owner].shares;
    }

    function getSharesOnSaleByAddress(address owner) external view returns (uint) {
        return ownershipMap[owner].sharesOnSale;
    }

    function getSupportedProposalsCount(address owner) external view returns (uint) {
        return ownershipMap[owner].supportedProposals.length;
    }

    function getSupportedProposalIdByIndex(address owner, uint idx) external view returns (uint) {
        // idx must be a valid index in the list of supported proposals
        require(idx < ownershipMap[owner].supportedProposals.length, "");
        return ownershipMap[owner].supportedProposals[idx];
    }

    function getOwnersCount() external view returns (uint) {
        return ownerList.length;
    }

    function getOwnerAddressByIndex(uint idx) external view returns (address) {
        // idx must be a valid index in the list of owners
        require(idx < ownerList.length, "");
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
            owner.sharesHistory[owner.sharesHistorySize] = DataPoint(owner.shares, block.timestamp);
            ++owner.sharesHistorySize;
            owner.pendingPayout += (totalPayout - owner.lastKnownPayout) * owner.shares / TOTAL_SHARES;
            owner.lastKnownPayout = totalPayout;
            owner.shares += amount;
        }
    }

    // decrease the amount of shares for a given owner;
    // if the owner is left without shares, they are removed from the list of owners;
    // proposal support is adjusted based on new amount of shares
    function decreaseShares(address ownerAddress, uint amount) private {
        Owner storage owner = ownershipMap[ownerAddress];
        owner.sharesHistory[owner.sharesHistorySize] = DataPoint(owner.shares, block.timestamp);
        ++owner.sharesHistorySize;
        owner.pendingPayout += (totalPayout - owner.lastKnownPayout) * owner.shares / TOTAL_SHARES;
        owner.lastKnownPayout = totalPayout;
        owner.shares -= amount;
    }

    // transfers shares from one account to another
    function transferShares(address from, address to, uint sharesAmount) private {
        decreaseShares(from, sharesAmount);
        increaseShares(to, sharesAmount);
    }

    // creates a new owner
    function addOwner(address ownerAddress, uint shares) private {
        ownershipMap[ownerAddress] = Owner({
            shares: shares,
            sharesOnSale: 0,
            listPosition: ownerList.length,
            supportedProposals: new uint[](0),
            lastKnownPayout : totalPayout,
            pendingPayout : 0,
            sharesHistorySize : 0
        });
        ownerList.push(ownerAddress);
    }

    // removes an owner from the ownerList
    function removeOwner(address ownerAddress) private {
        uint pos = ownershipMap[ownerAddress].listPosition;
        ownerList[pos] = ownerList[ownerList.length - 1];
        ownershipMap[ownerList[pos]].listPosition = pos;
        --ownerList.length;
    }

    

    //*****************************PAYMENTS****************************************************

    // the ether produced by the asset(s) is sent by calling this function
    function payment(string info) external payable {
        uint treasuryIncrease = (msg.value * treasuryRatio) / TREASURY_RATIO_DENOMINATOR;
        uint payout = msg.value - treasuryIncrease;
        payoutHistory.push(DataPoint(payout, block.timestamp));
        totalPayout += payout;
        treasuryBalance += treasuryIncrease;
        emit PAYMENT_RECEIVED(msg.sender, msg.value, info);
    }

    // a way to deposit money directly into the treasury
    function treasuryDeposit(string info) external payable {
        treasuryBalance += msg.value;
        emit TREASURY_DEPOSIT(msg.sender, msg.value, info);
    }

    // Returns the pending payout for the calling address
    function getPendingPayout ( ) external view returns (uint) {
        Owner storage owner = ownershipMap[msg.sender];
        return owner.pendingPayout + (totalPayout - owner.lastKnownPayout) * owner.shares / TOTAL_SHARES;
    }

    // Updates the pending payout for the given address
    function updatePendingPayout ( address addr ) external payable {
        Owner storage owner = ownershipMap[addr];
        owner.pendingPayout += (totalPayout - owner.lastKnownPayout) * owner.shares / TOTAL_SHARES;
        owner.lastKnownPayout = totalPayout;
    }

    // Sends the pending payout to the calling address
    function withdrawPayout ( ) external payable {
        Owner storage owner = ownershipMap[msg.sender];
        msg.sender.transfer(owner.pendingPayout + (totalPayout - owner.lastKnownPayout) * owner.shares / TOTAL_SHARES);
        owner.pendingPayout = 0;
        owner.lastKnownPayout = totalPayout;
    }

    function getPayoutHistoryLength ( ) external view returns (uint) {
        return payoutHistory.length;
    }

    function getPayoutInformation ( uint id ) external view returns (uint amount, uint timestamp) {
        DataPoint dataPoint = payoutHistory[id];
        amount = dataPoint.data;
        timestamp = dataPoint.timestamp;
    }

    function getSharesHistorySize ( ) external view returns (uint) {
        Owner storage owner = ownershipMap[msg.sender];
        return owner.sharesHistorySize;
    }
    
    function getSharesHistoryInformation ( uint id ) external view returns (uint amount, uint timestamp) {
        Owner storage owner = ownershipMap[msg.sender];
        DataPoint dataPoint = owner.sharesHistory[id];
        amount = dataPoint.data;
        timestamp = dataPoint.timestamp;
    }

    // returns the amount of funds in the treasury
    function getTreasuryBalance() external view returns (uint) {
        return treasuryBalance;
    }

    function getTreasuryRatio() external view returns (uint) {
        return treasuryRatio;
    }

    //*****************************OFFERS****************************************************

    // publishes a new SELL offer (transfer of shares from an owner to a buyer for a price)
    // use 0 for the intendedBuyer address to let anyone purchase the shares
    // set the price to 0 for gift
    function offerToSell(uint sharesAmount, uint price, address intendedBuyer) external {

        // owners cannot sell shares while supporting proposals.
        require(ownershipMap[msg.sender].supportedProposals.length == 0, "");

        // 0-shares auctions are not allowed
        require(sharesAmount > 0, "");

        // the caller must own the amount of shares they offer to sell
        require(sharesAmount  + ownershipMap[msg.sender].sharesOnSale <= ownershipMap[msg.sender].shares, "");

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

        // 0-shares auctions are not allowed
        require(sharesAmount > 0, "");

        // the caller must deposit the exact total sum of his offer
        require(msg.value == sharesAmount * price, "");

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

        // offer with given id must exist
        require(offerId < offerList.length, "");

        Offer storage offer = offerList[offerId];

        // the offer must have type SELL
        require(offer.offerType == OfferType.SELL, "");

        // the offer must be active
        require(offer.listPosition != MISSING, "");

        // the caller must be the intended buyer, if one is set
        require(offer.buyer == address(0) || offer.buyer == msg.sender, "");

        // the offer must contain the requested amount of shares
        require(offer.shares >= sharesAmount, "");

        // the caller must transfer the exact payment amount
        require(msg.value == sharesAmount * offer.price, "");

        // attempt to transfer funds to seller, revert if it fails
        require(offer.seller.send(msg.value), "");

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

        // offer with given id must exist
        require(offerId < offerList.length, "");

        Offer storage offer = offerList[offerId];

        // the offer must have type BUY
        require(offer.offerType == OfferType.BUY, "");

        // the offer must be active
        require(offer.listPosition != MISSING, "");

        // the caller must be the intended seller, if one is set
        require(offer.seller == address(0) || offer.seller == msg.sender, "");

        // the offer must contain the requested amount of shares
        require(offer.shares >= sharesAmount, "");

        // the caller must own the amount of shares they offer to sell
        require(sharesAmount + ownershipMap[msg.sender].sharesOnSale <= ownershipMap[msg.sender].shares, "");

        uint earnings = sharesAmount * offer.price;

        // attempt to transfer funds to seller, revert if it fails
        require(msg.sender.send(earnings), "");

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

        // offers with given ids must exist
        require(sellOfferId < offerList.length, "");
        require(buyOfferId < offerList.length, "");

        Offer storage sellOffer = offerList[sellOfferId];
        Offer storage buyOffer = offerList[buyOfferId];

        // the offers must have the right types
        require(sellOffer.offerType == OfferType.SELL, "");
        require(buyOffer.offerType == OfferType.BUY, "");

        // the offers must be active
        require(sellOffer.listPosition != MISSING, "");
        require(buyOffer.listPosition != MISSING, "");

        // the intended buyer / seller must be 0 or match the actual buyer / seller 
        require(sellOffer.buyer == address(0) || sellOffer.buyer == buyOffer.buyer, "");
        require(buyOffer.seller == address(0) || buyOffer.seller == sellOffer.seller, "");

        // the amount of ether offered by the buyer must be equal or higher to the amount requested by the seller
        require(sellOffer.price <= buyOffer.price, "");

        uint sharesAmount = (sellOffer.shares < buyOffer.shares ? sellOffer.shares : buyOffer.shares);
        uint sellerRevenue;

        // the caller gets the better deal basd on their role
        if (msg.sender == sellOffer.seller) {
            sellerRevenue = sharesAmount * buyOffer.price;
        } else if (msg.sender == buyOffer.buyer) {
            sellerRevenue = sharesAmount * sellOffer.price;
            // refund the buyer the difference
            require(msg.sender.send(sharesAmount * (buyOffer.price - sellOffer.price)), "");
        } else {
            require(false, ""); // the caller must be the owner of one of the offers
        }

        // pay seller
        require(sellOffer.seller.send(sellerRevenue), "");

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

        // offer with id must exist
        require(offerId < offerList.length, "");

        Offer storage offer = offerList[offerId];
        offer.completionDate = block.timestamp;

        // offer must be active
        require(offer.listPosition != MISSING, "");

        if (offer.offerType == OfferType.SELL) {
            // only the owner of the offer can cancel it
            require(msg.sender == offer.seller, "");
            ownershipMap[msg.sender].sharesOnSale -= offer.shares;
        } else { // OfferType.BUY
            // only the owner of the offer can cancel it
            require(msg.sender == offer.buyer, "");

            // refund buyer for shares not purchased
            require(msg.sender.send(offer.shares * offer.price), "");
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
        require(idx < activeOffersList.length, "");
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
        require(offerId < offerList.length, "");
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

    //*****************************PROPOSALS****************************************************

    function getProposalApprovalThreshold() external view returns (uint) {
        return proposalApprovalThreshold;
    }

    function isActiveProposal(uint id) private view returns (bool) {
        return proposalList[id].listPosition != MISSING && proposalList[id].expirationDate > block.timestamp;
    }

    function removeSupportedProposalByIndex(uint idx) private {
        Owner storage owner = ownershipMap[msg.sender];
        owner.supportedProposals[idx] = owner.supportedProposals[owner.supportedProposals.length - 1];
        proposalList[owner.supportedProposals[idx]].positionMap[msg.sender] = idx;
        --owner.supportedProposals.length;
    }

    function removeInactiveSupportedProposalByIndex(uint idx) external {
        Owner storage owner = ownershipMap[msg.sender];
        // supported proposal with index must exist
        require(idx < owner.supportedProposals.length, "");

        // active supported proposals can only be removed by calling revokeProposalSupport
        require(!isActiveProposal(owner.supportedProposals[idx]), "");
        removeSupportedProposalByIndex(idx);
        emit REMOVED_SUPPORTED_PROPOSAL(idx);
    }

    function getTaskFunctionValues() external pure returns (TaskFunction CHANGE_APPROVAL_TRESHOLD,
                                                            TaskFunction CHANGE_ASSET_DESCRIPTION,
                                                            TaskFunction CHANGE_TREASURY_RATIO,
                                                            TaskFunction EXECUTE_EXTERNAL_CONTRACT,
                                                            TaskFunction ORIGINAL,
                                                            TaskFunction SEND_MONEY) {
        CHANGE_APPROVAL_TRESHOLD = TaskFunction.CHANGE_APPROVAL_TRESHOLD;
        CHANGE_ASSET_DESCRIPTION = TaskFunction.CHANGE_ASSET_DESCRIPTION;
        CHANGE_TREASURY_RATIO = TaskFunction.CHANGE_TREASURY_RATIO;
        EXECUTE_EXTERNAL_CONTRACT = TaskFunction.EXECUTE_EXTERNAL_CONTRACT;
        ORIGINAL = TaskFunction.ORIGINAL;
        SEND_MONEY = TaskFunction.SEND_MONEY;
    }

    // publishes a new proposal, the author starts with a 'yes' vote on it
    function makeProposal(string reason, uint expirationDate, uint functionId, uint uintArg,
                          string stringArg, address addressArg) external {
        
        // only owners can make proposals
        requireOwner("");

        Owner storage owner = ownershipMap[msg.sender];

        // owners cannot make proposals while selling shares
        require(owner.sharesOnSale == 0, "");

        // expiration date must be in he future
        require(expirationDate > block.timestamp, "");
        
        validateProposalArgs(TaskFunction(functionId), uintArg, stringArg, addressArg);

        uint id = proposalList.length;

        // create new active proposal
        proposalList.push(
            Proposal({
                id: id,
                owner: msg.sender,
                listPosition: activeProposalsList.length,
                reason: reason,
                task: Task(TaskFunction(functionId), uintArg, stringArg, addressArg),
                support: owner.shares,  // proposal publisher starts with 'yes' vote
                creationDate: block.timestamp,
                expirationDate: expirationDate,
                completionDate: 0,
                cancelled: false
            })
        );
        activeProposalsList.push(id);

        // proposal publisher starts with 'yes' vote
        proposalList[id].supportMap[msg.sender] = owner.shares;
        proposalList[id].positionMap[msg.sender] = owner.supportedProposals.length;
        owner.supportedProposals.push(id);

        emit NEW_PROPOSAL(id);
    }

    function validateProposalArgs(TaskFunction functionId, uint uintArg, string stringArg, address addressArg) private pure {

        // approval threshold cannot exceed 100%
        require(functionId != TaskFunction.CHANGE_APPROVAL_TRESHOLD || uintArg < TOTAL_SHARES,"");
        // treasury ratio cannot exceed 100%
        require(functionId != TaskFunction.CHANGE_TREASURY_RATIO || uintArg < TREASURY_RATIO_DENOMINATOR, "");
    }

    // implements a 'yes' vote or updates the weight of a preexisting vote
    function supportProposal(uint id) external {

        // only owners can vote
        requireOwner("");

        // invalid proposal id
        require(id < proposalList.length, "");

        // the proposal is no longer active
        require(isActiveProposal(id), "");

        Owner storage owner = ownershipMap[msg.sender];

        Proposal storage proposal = proposalList[id];

        // owners cannot vote while selling shares
        require(owner.sharesOnSale == 0, "");

        // the caller is already fully supporting this proposal
        require(owner.shares > proposal.supportMap[msg.sender], "");

        if (proposal.supportMap[msg.sender] == 0) {
            // owner is not already supporting this proposal
            proposal.positionMap[msg.sender] = owner.supportedProposals.length;
            owner.supportedProposals.push(id);
            proposal.support += owner.shares;
        } else {
            // owner is already supporting this proposal, but has more shares now
            proposal.support += owner.shares - proposal.supportMap[msg.sender];
        }

        proposal.supportMap[msg.sender] = owner.shares;

        emit VOTE(msg.sender, id, true);
    }

    // revokes support from an active proposal
    function revokeProposalSupport(uint id) external {
        // check for owner not necessary
        // check for selling offers not necessary

        // proposal with id must exist
        require(id < proposalList.length, "");

        // proposal must be active
        require(isActiveProposal(id), "");

        Proposal storage proposal = proposalList[id];

        // the caller must be supporting the proposal
        require(proposal.supportMap[msg.sender] != 0, "");

        proposal.support -= proposal.supportMap[msg.sender];
        proposal.supportMap[msg.sender] = 0;

        removeSupportedProposalByIndex(proposal.positionMap[msg.sender]);
        
        emit VOTE(msg.sender, id, false);
    }

    function executeProposal(uint id) external {

        // proposal with id must exist
        require(id < proposalList.length, "");

        Proposal storage proposal = proposalList[id];

        // proposal must be active
        require(isActiveProposal(id), "");

        // the proposal support must reach the threshold to be approved
        require(proposal.support >= proposalApprovalThreshold, "");

        // execute proposal task

        TaskFunction functionId = proposal.task.functionId;

        if (functionId == TaskFunction.CHANGE_APPROVAL_TRESHOLD) {

            proposalApprovalThreshold = proposal.task.uintArg;

        } else if (functionId == TaskFunction.CHANGE_ASSET_DESCRIPTION) {

            assetDescription = proposal.task.stringArg;

        } else if (functionId == TaskFunction.CHANGE_TREASURY_RATIO) {

            treasuryRatio = proposal.task.uintArg;

        } else if (functionId == TaskFunction.EXECUTE_EXTERNAL_CONTRACT) {

            // the treasury must contain the amount of money to be transfered
            require(proposal.task.uintArg <= treasuryBalance, "");
            // attempt to call external function, revert if it fails
            require(
                proposal.task.addressArg.call.value(proposal.task.uintArg)(
                    abi.encodeWithSignature(proposal.task.stringArg)
                ),
                ""
            );
            treasuryBalance -= proposal.task.uintArg;

        } else if (functionId == TaskFunction.SEND_MONEY) {

            // the treasury must contain the amount of money to be transfered
            require(proposal.task.uintArg <= treasuryBalance, "");
            // attempt to transfer funds to seller, revert if it fails
            require(proposal.task.addressArg.send(proposal.task.uintArg), "");
            treasuryBalance -= proposal.task.uintArg;
        } // nothing to do for TaskFunction.ORIGINAL

        deactivateProposal(id);

        emit EXECUTED_PROPOSAL(id);
    }

    // deactivates an active proposal owned by the caller
    function cancelProposal(uint id) external {

        // proposal with id must exist
        require(id < proposalList.length, "");

        // proposal must be active
        require(proposalList[id].listPosition != MISSING, "");

        // only the author of the proposal can cancel it before its expiration date
        require(msg.sender == proposalList[id].owner || proposalList[id].expirationDate <= block.timestamp, "");

        proposalList[id].cancelled = true;
        deactivateProposal(id);
        emit CANCELLED_PROPOSAL(id);
    }

    // removes a proposal from the list of active proposals
    function deactivateProposal(uint id) private {
        Proposal storage proposal = proposalList[id];
        proposal.completionDate = block.timestamp;

        uint pos = proposal.listPosition;
        activeProposalsList[pos] = activeProposalsList[activeProposalsList.length - 1];
        proposalList[activeProposalsList[pos]].listPosition = pos;
        proposal.listPosition = MISSING;
        --activeProposalsList.length;
    }

    function getActiveProposalsCount() external view returns (uint) {
        return activeProposalsList.length;
    }

    function getProposalsCount() external view returns (uint) {
        return proposalList.length;
    }

    function getActiveProposalByIndex(uint idx) external view returns (uint id,
                                                                       address owner,
                                                                       string reason,
                                                                       TaskFunction functionId,
                                                                       uint uintArg,
                                                                       string stringArg,
                                                                       address addressArg,
                                                                       uint support,
                                                                       uint creationDate,
                                                                       uint expirationDate,
                                                                       uint completionDate,
                                                                       bool cancelled) {
        require(idx < activeProposalsList.length, "");
        return getProposal(activeProposalsList[idx]);
    }

    function getProposal(uint propId) public view returns (uint id,
                                                           address owner,
                                                           string reason,
                                                           TaskFunction functionId,
                                                           uint uintArg,
                                                           string stringArg,
                                                           address addressArg,
                                                           uint support,
                                                           uint creationDate,
                                                           uint expirationDate,
                                                           uint completionDate,
                                                           bool cancelled) {
        require(propId < proposalList.length, "");
        Proposal storage proposal = proposalList[propId];
        id = proposal.id;
        owner = proposal.owner;
        reason = proposal.reason;
        functionId = proposal.task.functionId;
        uintArg = proposal.task.uintArg;
        stringArg = proposal.task.stringArg;
        addressArg = proposal.task.addressArg;
        support = proposal.support;
        creationDate = proposal.creationDate;
        expirationDate = proposal.expirationDate;
        completionDate = proposal.completionDate;
        cancelled = proposal.cancelled;
    }

}

