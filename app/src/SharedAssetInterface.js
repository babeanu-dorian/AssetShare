export default [
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getSupportedProposalsCount",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getAssetDescription",
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [],
    "name": "withdrawPayout",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getProposalApprovalThreshold",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "executeProposal",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "supportProposal",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getActiveProposalsCount",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "offerId",
        "type": "uint256"
      },
      {
        "name": "sharesAmount",
        "type": "uint256"
      }
    ],
    "name": "sellShares",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "revokeProposalSupport",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getTaskFunctionValues",
    "outputs": [
      {
        "name": "CHANGE_APPROVAL_TRESHOLD",
        "type": "uint8"
      },
      {
        "name": "CHANGE_ASSET_DESCRIPTION",
        "type": "uint8"
      },
      {
        "name": "CHANGE_TREASURY_RATIO",
        "type": "uint8"
      },
      {
        "name": "EXECUTE_EXTERNAL_CONTRACT",
        "type": "uint8"
      },
      {
        "name": "ORIGINAL",
        "type": "uint8"
      },
      {
        "name": "SEND_MONEY",
        "type": "uint8"
      }
    ],
    "payable": false,
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getOffersCount",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "offerId",
        "type": "uint256"
      }
    ],
    "name": "getOffer",
    "outputs": [
      {
        "name": "id",
        "type": "uint256"
      },
      {
        "name": "offerType",
        "type": "string"
      },
      {
        "name": "seller",
        "type": "address"
      },
      {
        "name": "buyer",
        "type": "address"
      },
      {
        "name": "shares",
        "type": "uint256"
      },
      {
        "name": "price",
        "type": "uint256"
      },
      {
        "name": "creationDate",
        "type": "uint256"
      },
      {
        "name": "completionDate",
        "type": "uint256"
      },
      {
        "name": "cancelled",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getSharesOnSaleByAddress",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getSharesSoldGainsByAddress",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "sharesAmount",
        "type": "uint256"
      },
      {
        "name": "price",
        "type": "uint256"
      },
      {
        "name": "intendedBuyer",
        "type": "address"
      }
    ],
    "name": "offerToSell",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      },
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getSupportedProposalIdByIndex",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getOwnersCount",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getSharesByAddress",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getActiveProposalByIndex",
    "outputs": [
      {
        "name": "id",
        "type": "uint256"
      },
      {
        "name": "owner",
        "type": "address"
      },
      {
        "name": "reason",
        "type": "string"
      },
      {
        "name": "functionId",
        "type": "uint8"
      },
      {
        "name": "uintArg",
        "type": "uint256"
      },
      {
        "name": "stringArg",
        "type": "string"
      },
      {
        "name": "addressArg",
        "type": "address"
      },
      {
        "name": "support",
        "type": "uint256"
      },
      {
        "name": "creationDate",
        "type": "uint256"
      },
      {
        "name": "expirationDate",
        "type": "uint256"
      },
      {
        "name": "completionDate",
        "type": "uint256"
      },
      {
        "name": "cancelled",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "TOTAL_SHARES",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getShareValueHistoryByIdx",
    "outputs": [
      {
        "name": "amount",
        "type": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getActiveOffersCount",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "sellOfferId",
        "type": "uint256"
      },
      {
        "name": "buyOfferId",
        "type": "uint256"
      }
    ],
    "name": "combineOffers",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getProposalsCount",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getPaymentHistoryByIdx",
    "outputs": [
      {
        "name": "amount",
        "type": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      },
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getSharesHistoryByIdx",
    "outputs": [
      {
        "name": "amount",
        "type": "uint256"
      },
      {
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getTreasuryBalance",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "info",
        "type": "string"
      }
    ],
    "name": "payment",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "info",
        "type": "string"
      }
    ],
    "name": "treasuryDeposit",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "offerId",
        "type": "uint256"
      },
      {
        "name": "sharesAmount",
        "type": "uint256"
      }
    ],
    "name": "buyShares",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "propId",
        "type": "uint256"
      }
    ],
    "name": "getProposal",
    "outputs": [
      {
        "name": "id",
        "type": "uint256"
      },
      {
        "name": "owner",
        "type": "address"
      },
      {
        "name": "reason",
        "type": "string"
      },
      {
        "name": "functionId",
        "type": "uint8"
      },
      {
        "name": "uintArg",
        "type": "uint256"
      },
      {
        "name": "stringArg",
        "type": "string"
      },
      {
        "name": "addressArg",
        "type": "address"
      },
      {
        "name": "support",
        "type": "uint256"
      },
      {
        "name": "creationDate",
        "type": "uint256"
      },
      {
        "name": "expirationDate",
        "type": "uint256"
      },
      {
        "name": "completionDate",
        "type": "uint256"
      },
      {
        "name": "cancelled",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "removeInactiveSupportedProposalByIndex",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getShareValueHistoryLength",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "sharesAmount",
        "type": "uint256"
      },
      {
        "name": "price",
        "type": "uint256"
      },
      {
        "name": "intendedSeller",
        "type": "address"
      }
    ],
    "name": "offerToBuy",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "MISSING",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "reason",
        "type": "string"
      },
      {
        "name": "expirationDate",
        "type": "uint256"
      },
      {
        "name": "functionId",
        "type": "uint256"
      },
      {
        "name": "uintArg",
        "type": "uint256"
      },
      {
        "name": "stringArg",
        "type": "string"
      },
      {
        "name": "addressArg",
        "type": "address"
      }
    ],
    "name": "makeProposal",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getActiveOfferByIndex",
    "outputs": [
      {
        "name": "id",
        "type": "uint256"
      },
      {
        "name": "offerType",
        "type": "string"
      },
      {
        "name": "seller",
        "type": "address"
      },
      {
        "name": "buyer",
        "type": "address"
      },
      {
        "name": "shares",
        "type": "uint256"
      },
      {
        "name": "price",
        "type": "uint256"
      },
      {
        "name": "creationDate",
        "type": "uint256"
      },
      {
        "name": "completionDate",
        "type": "uint256"
      },
      {
        "name": "cancelled",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getSharesHistoryLength",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "getOwnerAddressByIndex",
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getSharesInvestmentByAddress",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "cancelProposal",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getPaymentHistoryLength",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "getTreasuryRatio",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "offerId",
        "type": "uint256"
      }
    ],
    "name": "cancelOffer",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "TREASURY_RATIO_DENOMINATOR",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {
        "name": "ownerAddress",
        "type": "address"
      }
    ],
    "name": "getPendingPayout",
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "name": "initialOwner",
        "type": "address"
      },
      {
        "name": "description",
        "type": "string"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "info",
        "type": "string"
      }
    ],
    "name": "PAYMENT_RECEIVED",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "sender",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "amount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "info",
        "type": "string"
      }
    ],
    "name": "TREASURY_DEPOSIT",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "NEW_OFFER",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "CANCELLED_OFFER",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "from",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "sharesAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "cost",
        "type": "uint256"
      }
    ],
    "name": "SHARES_TRANSFERED",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "NEW_PROPOSAL",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "EXECUTED_PROPOSAL",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "id",
        "type": "uint256"
      }
    ],
    "name": "CANCELLED_PROPOSAL",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "idx",
        "type": "uint256"
      }
    ],
    "name": "REMOVED_SUPPORTED_PROPOSAL",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "voter",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "propId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "vote",
        "type": "bool"
      }
    ],
    "name": "VOTE",
    "type": "event"
  }
]