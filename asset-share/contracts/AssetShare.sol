pragma solidity ^0.5.0;

import "@aragon/os/contracts/apps/AragonApp.sol";
import "@aragon/os/contracts/lib/math/SafeMath.sol";

contract AssetShare is AragonApp {

  enum OfferType {
    SELL,
    BUY
  }

  struct Offer {              // describes an offer for selling / buying / gifting shares
    uint id;                  // offer id (index in the offerList)
    OfferType offerType;      // the type of the offer (BUY or SELL)
    uint listPosition;        // position in the activeOffersList (MISSING if not active)
    address payable seller;   // address of the one making the offer
    address buyer;            // address of the intended recepient of the offer (empty for public auction)
    uint shares;              // amount of offered shares
    uint price;               // price of the shares in wei (set to 0 for gift)
    uint creationDate;        // unix timestamp of the date when the offer was published
    uint expirationDate;      // unix timestamp of the date when the offer expires
    uint completionDate;      // unix timestamp of the date when the shares were transfered
  }

  uint constant public MISSING = ~uint256(0);                  // max uint value, signals missing data
  uint constant public TOTAL_SHARES = 1000000;                 // total number of ownership shares
  uint constant public TREASURY_RATIO_DENOMINATOR = 1000000;   // the ratio of ether placed in the treasury
                                                               // = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR

  uint constant private DEFAULT_TREASURY_RATIO = 100000;       // default value of treasuryRatio
  uint constant private DEFAULT_PAYOUT_PERIOD = 60;            // default value of payoutPeriod

  string[] private assetDescriptionList;                       // textual description of each asset

  mapping(address => uint) private ownershipMap;               // maps each address 
  address payable[] private ownerList;                         // list of owner addresses

  uint private treasuryBalance;                 // wei in the treasury
  uint private treasuryRatio;                   // the ratio of ether placed in the treasury
                                                //     = (amount * treasuryRatio) / TREASURY_RATIO_DENOMINATOR
  uint private payoutPeriod;                    // time interval between shareholder payout (in seconds)
  uint private lastPayday;                      // unix timestamp of last theoretical* payout
                                                //     *Time when the payout should have happened

  Offer[] offerList;                            // list of all offers
  uint[] private activeOffersList;              // list indexes of active ofers

  constructor() public {

    // contract creator starts as sole owner
    ownerList.push(address(uint160(msg.sender)));
    ownershipMap[msg.sender] = TOTAL_SHARES;

    // init defaults
    treasuryBalance = 0;
    treasuryRatio = DEFAULT_TREASURY_RATIO;
    payoutPeriod = DEFAULT_PAYOUT_PERIOD;
    lastPayday = block.timestamp;
  }

  function initialize() public onlyInit {
    initialized();
  }

  // the ether produced by the asset(s) is sent by calling this function
  function payment(string calldata info) external payable {
      // TODO: do something with the message, maybe fire an event, or store it in history ?
      // use msg.value to see how much wei was received
  }

  // a way for the owners to deposit money into the treasury
  function treasuryDeposit() external payable {
      treasuryBalance += msg.value;
  }

  // 
  function getTreasuryBalance() external view returns (uint) {
      return treasuryBalance;
  }

  // checks if at least one payout period has passed, and if it did, it divides the contract balance between the treasury
  // and the shareholders
  function payOwners() external {
      uint timeElapsed = block.timestamp - lastPayday;
      if (timeElapsed >= payoutPeriod) {
          // account for multiple payout periods
          lastPayday = block.timestamp - (timeElapsed % payoutPeriod);
          divideAndTransferFunds();
      }
  }

  // divides the contract balance between the treasury and the shareholders
  function divideAndTransferFunds() private {

      // funds accumulated since last division
      uint funds = address(this).balance - treasuryBalance;

      // store treasury funds
      uint treasuryGains = (funds * treasuryRatio) / TREASURY_RATIO_DENOMINATOR;
      treasuryBalance += treasuryGains;
      funds -= treasuryGains;

      // send owners' gains
      for (uint i = 0; i != ownerList.length; ++i) {
          ownerList[i].send((funds * ownershipMap[ownerList[i]]) / TOTAL_SHARES);
      }
  }

  // publishes a new SELL offer (transfer of shares from an owner to a buyer for a price)
  // use 0x0 for the receiver address to let anyone purchase the shares
  // set the price to 0 for gift
  function offerToSell(uint sharesAmount, uint price, address receiver, uint availabilityPeriod) external {

      require(sharesAmount > 0, "0-shares auctions are not allowed.");
      require(sharesAmount <= ownershipMap[msg.sender], "Caller does not own this many shares.");

      // create new SELL offer
      offerList.push(Offer(offerList.length, OfferType.SELL, activeOffersList.length, msg.sender, receiver,
                            sharesAmount, price, block.timestamp, block.timestamp + availabilityPeriod, 0));

      // add it to the list of active offers
      activeOffersList.push(offerList.length - 1);
  }

  // allows the caller to complete a SELL offer and performs the exchange of shares and ether
  // if any of the requirements fail, the transaction (including the transferred money) is reverted
  function buyShares(uint offerId) external payable {
      require(offerId < offerList.length, "Invalid offer id.");

      Offer storage offer = offerList[offerId];

      require(offer.offerType == OfferType.SELL, "Offer is not a sale.");

      require(offer.listPosition != MISSING && block.timestamp < offer.expirationDate,
              "Offer is no longer active.");

      if (offer.buyer != address(0)) {
          require(msg.sender == offer.buyer, "Caller is not the intended buyer.");
      }

      require(msg.value == offer.price, "Caller did not transfer the exact payment amount.");

      // attempt to transfer funds to seller, revert if it fails
      require(offer.seller.send(msg.value), "Funds could not be forwarded. Transaction denied.");

      // transfer shares
      if (ownershipMap[msg.sender] == 0) {
          ownerList.push(msg.sender);
      }
      ownershipMap[msg.sender] += offer.shares;
      ownershipMap[offer.seller] -= offer.shares;
      if (ownershipMap[offer.seller] == 0) {
          removeOwner(offer.seller);
      }

      // complete offer
      offer.completionDate = block.timestamp;
      deactivateOffer(offerId);
  }

  // removes an owner from the ownerList
  function removeOwner(address owner) private {
      for (uint i = 0; i != ownerList.length; ++i) {
          if (ownerList[i] == owner) {
              ownerList[i] = ownerList[ownerList.length - 1];
              --ownerList.length;
              return;
          }
      }
  }

  // deactivates an active auction owned by the caller
  function cancelOffer(uint offerId) external {
      require(offerId < offerList.length, "Invalid offer id.");
      require(msg.sender == offerList[offerId].seller, "Caller does not own this offer.");
      require(offerList[offerId].listPosition != MISSING, "Offer is already inactive.");

      deactivateOffer(offerId);
  }

  // removes an auction from the list of active auctions
  function deactivateOffer(uint offerId) private {
      uint pos = offerList[offerId].listPosition;
      offerList[offerId].listPosition = MISSING;
      activeOffersList[pos] = activeOffersList[activeOffersList.length - 1];
      --activeOffersList.length;
  }
}