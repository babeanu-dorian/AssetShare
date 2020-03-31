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
    event NEW_PROPOSAL(uint id);
    event EXECUTED_PROPOSAL(uint id);
    event CANCELLED_PROPOSAL(uint id);
    event REMOVED_SUPPORTED_PROPOSAL(uint idx);
    event VOTE(address voter, uint propId, bool vote);

    struct Owner {                  // used to store shareholder information
        uint shares;                // amount of shares owned by shareholder
        uint sharesOnSale;          // amount of the owner's shares currently on sale
        uint listPosition;          // position in the ownerList
        uint[] supportedProposals;  // list of ids of proposals currently supported
    }

    enum OfferType {
        SELL,
        BUY
    }

    struct Offer {                // describes an offer for selling / buying / gifting shares
        uint id;                  // offer id (index in the offerList.txt)
        OfferType offerType;      // the type of the offer (BUY or SELL)
        uint listPosition;        // position in the activeOffersList (MISSING if not active)
        address seller;           // address of the one making the offer
        address buyer;            // address of the intended recepient of the offer (empty for public auction)
        uint shares;              // amount of offered shares
        uint price;               // price of the shares in wei (set to 0 for gift)
        uint creationDate;        // unix timestamp of the date when the offer was published
        uint completionDate;      // unix timestamp of the date when the shares were transferred or the offer was cancelled
        bool cancelled;           // whether or not the offer was cancelled
    }

    enum TaskFunction {                  // describes specific functions that can be used with tasks
        CHANGE_APPROVAL_TRESHOLD,        // edit the value of proposalApprovalThreshold
        CHANGE_ASSET_DESCRIPTION,        // edit the value of assetDescription
        CHANGE_PAYOUT_PERIOD,            // edit the value of payoutPeriod
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
    uint constant private DEFAULT_PAYOUT_PERIOD = 60;            // default value of payoutPeriod
    uint constant private DEFAULT_APPROVAL_TRESHOLD              // default value of proposalApprovalThreshold
                                      = TOTAL_SHARES / 2 + 1;

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

    Proposal[] proposalList;                    // list of all proposals
    uint[] private activeProposalsList;         // list of id's of ongoing proposals
    uint private proposalApprovalThreshold;     // amount of votes required to approve a proposal

    function initialize() public onlyInit {

        // TODO: pass this in as parameter
        address initialOwner = address(0xb4124cEB3451635DAcedd11767f004d8a28c6eE7);

        // contract creator starts as sole owner
        addOwner(initialOwner, TOTAL_SHARES);

        // set default values
        treasuryBalance = 0;
        treasuryRatio = DEFAULT_TREASURY_RATIO;
        payoutPeriod = DEFAULT_PAYOUT_PERIOD;
        lastPayday = block.timestamp;
        proposalApprovalThreshold = DEFAULT_APPROVAL_TRESHOLD;

        initialized();

    }

    function getAssetDescription() external view returns (string) {
        return assetDescription;
    }

    //*****************************OWNERS****************************************************

    function requireOwner(string errorMsg) private view {
        require(ownershipMap[msg.sender].shares > 0, errorMsg);
    }

    function getShares(address owner) external view returns (uint) {
        return ownershipMap[owner].shares;
    }

    function getSharesOnSale(address owner) external view returns (uint) {
        return ownershipMap[owner].sharesOnSale;
    }

    function getSupportedProposalsCount(address owner) external view returns (uint) {
        return ownershipMap[owner].supportedProposals.length;
    }

    function getSupportedProposalIdByIndex(address owner, uint idx) external view returns (uint) {
        require(idx < ownershipMap[owner].supportedProposals.length, "Invalid supported proposal index.");
        return ownershipMap[owner].supportedProposals[idx];
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

    // creates a new owner
    function addOwner(address ownerAddress, uint shares) private {
        ownershipMap[ownerAddress] = Owner({
            shares: shares,
            sharesOnSale: 0,
            listPosition: ownerList.length,
            supportedProposals: new uint[](0)
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

    function getTreasuryRatio() external view returns (uint) {
        return treasuryRatio;
    }

    // returns the amount of funds that will be split between shareholders upon the next payday
    function getFunds() public view returns (uint) {
        return address(this).balance - treasuryBalance;
    }

    function getPayoutPeriod() public view returns (uint) {
        return payoutPeriod;
    }

    //*****************************OFFERS****************************************************

    // publishes a new SELL offer (transfer of shares from an owner to a buyer for a price)
    // use 0 for the receiver address to let anyone purchase the shares
    // set the price to 0 for gift
    function offerToSell(uint sharesAmount, uint price, address receiver) external {

        require(ownershipMap[msg.sender].supportedProposals.length == 0,
            "You cannot sell shares while supporting proposals.");

        require(sharesAmount > 0, "0-shares auctions are not allowed.");

        require(sharesAmount  + ownershipMap[msg.sender].sharesOnSale <= ownershipMap[msg.sender].shares,
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
    function buyShares(uint offerId) external payable {
        require(offerId < offerList.length, "Invalid offer id.");

        Offer storage offer = offerList[offerId];

        require(offer.offerType == OfferType.SELL, "Offer is not a sale.");

        require(offer.listPosition != MISSING, "Offer is no longer active.");

        require(offer.buyer == address(0) || offer.buyer == msg.sender, "Caller is not the intended buyer.");

        require(msg.value == offer.price, "Caller did not transfer the exact payment amount.");

        // attempt to transfer funds to seller, revert if it fails
        require(offer.seller.send(msg.value), "Funds could not be forwarded. Transaction denied.");

        // transfer shares
        increaseShares(msg.sender, offer.shares);
        decreaseShares(offer.seller, offer.shares);

        // complete offer
        offer.buyer = msg.sender;
        deactivateOffer(offerId);

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
        offer.completionDate = block.timestamp;

        if (offer.offerType == OfferType.SELL) {
            ownershipMap[offer.seller].sharesOnSale -= offer.shares;
        }

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
        require(idx < owner.supportedProposals.length, "Invalid supported proposal index.");
        require(!isActiveProposal(owner.supportedProposals[idx]),
            "The proposal is still active, call revokeProposalSupport.");
        removeSupportedProposalByIndex(idx);
        emit REMOVED_SUPPORTED_PROPOSAL(idx);
    }

    function getTaskFunctionValues() external pure returns (TaskFunction CHANGE_APPROVAL_TRESHOLD,
                                                            TaskFunction CHANGE_ASSET_DESCRIPTION,
                                                            TaskFunction CHANGE_PAYOUT_PERIOD,
                                                            TaskFunction CHANGE_TREASURY_RATIO,
                                                            TaskFunction EXECUTE_EXTERNAL_CONTRACT,
                                                            TaskFunction ORIGINAL,
                                                            TaskFunction SEND_MONEY) {
        CHANGE_APPROVAL_TRESHOLD = TaskFunction.CHANGE_APPROVAL_TRESHOLD;
        CHANGE_ASSET_DESCRIPTION = TaskFunction.CHANGE_ASSET_DESCRIPTION;
        CHANGE_PAYOUT_PERIOD = TaskFunction.CHANGE_PAYOUT_PERIOD;
        CHANGE_TREASURY_RATIO = TaskFunction.CHANGE_TREASURY_RATIO;
        EXECUTE_EXTERNAL_CONTRACT = TaskFunction.EXECUTE_EXTERNAL_CONTRACT;
        ORIGINAL = TaskFunction.ORIGINAL;
        SEND_MONEY = TaskFunction.SEND_MONEY;
    }

    // publishes a new proposal, the author starts with a 'yes' vote on it
    function makeProposal(string reason, uint expirationDate, uint functionId, uint uintArg,
                          string stringArg, address addressArg) external {
        
        requireOwner("Only owners can make proposals.");

        Owner storage owner = ownershipMap[msg.sender];

        require(owner.sharesOnSale == 0, "You cannot make proposals while selling shares.");

        require(expirationDate > block.timestamp, "Expiration date must be in the future.");
        
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

        require(functionId != TaskFunction.CHANGE_APPROVAL_TRESHOLD || uintArg < TOTAL_SHARES,
                "Approval threshold cannot exceed 100%");
        require(functionId != TaskFunction.CHANGE_TREASURY_RATIO || uintArg < TREASURY_RATIO_DENOMINATOR,
                "Treasury ratio cannot exceed 100%");
    }

    // implements a 'yes' vote or updates the weight of a preexisting vote
    function supportProposal(uint id) external {

        requireOwner("Only owners can vote.");

        require(id < proposalList.length, "Invalid proposal id.");

        require(isActiveProposal(id), "The proposal is no longer active.");

        Owner storage owner = ownershipMap[msg.sender];

        Proposal storage proposal = proposalList[id];

        require(owner.sharesOnSale == 0, "You cannot vote while selling shares.");

        require(owner.shares > proposal.supportMap[msg.sender], "Caller is already fully supporting this proposal.");

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

        require(id < proposalList.length, "Invalid proposal id.");

        require(isActiveProposal(id), "The proposal is no longer active.");

        Proposal storage proposal = proposalList[id];

        require(proposal.supportMap[msg.sender] != 0, "Caller is not supporting this proposal.");

        proposal.support -= proposal.supportMap[msg.sender];
        proposal.supportMap[msg.sender] = 0;

        removeSupportedProposalByIndex(proposal.positionMap[msg.sender]);
        
        emit VOTE(msg.sender, id, false);
    }

    function executeProposal(uint id) external {
        require(id < proposalList.length, "Invalid proposal id.");

        Proposal storage proposal = proposalList[id];

        require(isActiveProposal(id), "The proposal is no longer active.");

        require(proposal.support >= proposalApprovalThreshold, "The proposal does not have enough support.");

        // execute proposal task

        TaskFunction functionId = proposal.task.functionId;

        if (functionId == TaskFunction.CHANGE_APPROVAL_TRESHOLD) {

            proposalApprovalThreshold = proposal.task.uintArg;

        } else if (functionId == TaskFunction.CHANGE_ASSET_DESCRIPTION) {

            assetDescription = proposal.task.stringArg;

        } else if (functionId == TaskFunction.CHANGE_PAYOUT_PERIOD) {

            payoutPeriod = proposal.task.uintArg;

        } else if (functionId == TaskFunction.CHANGE_TREASURY_RATIO) {

            treasuryRatio = proposal.task.uintArg;

        } else if (functionId == TaskFunction.EXECUTE_EXTERNAL_CONTRACT) {

            require(proposal.task.uintArg <= treasuryBalance, "Insufficient treasury funds.");
            // attempt to call external function, revert if it fails
            require(
                proposal.task.addressArg.call.value(proposal.task.uintArg)(
                    abi.encodeWithSignature(proposal.task.stringArg)
                ),
                "Something went wrong when calling external contract, transaction denied."
            );
            treasuryBalance -= proposal.task.uintArg;

        } else if (functionId == TaskFunction.SEND_MONEY) {

            require(proposal.task.uintArg <= treasuryBalance, "Insufficient treasury funds.");
            // attempt to transfer funds to seller, revert if it fails
            require(proposal.task.addressArg.send(proposal.task.uintArg),
                "Funds could not be sent, transaction denied.");
            treasuryBalance -= proposal.task.uintArg;
        } // nothing to do for TaskFunction.ORIGINAL

        deactivateProposal(id);

        emit EXECUTED_PROPOSAL(id);
    }

    // deactivates an active proposal owned by the caller
    function cancelProposal(uint id) external {
        require(id < proposalList.length, "Invalid proposal id.");
        require(proposalList[id].listPosition != MISSING, "Proposal is already inactive.");
        require(msg.sender == proposalList[id].owner || proposalList[id].expirationDate <= block.timestamp,
            "Only the author of the proposal can cancel it before its expiration date.");

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
        require(idx < activeProposalsList.length, "Invalid active proposal index.");
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
        require(propId < proposalList.length, "Invalid proposal id.");
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
