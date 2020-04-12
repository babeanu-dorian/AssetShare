/* global artifacts contract beforeEach it assert */

const { assertRevert } = require('@aragon/test-helpers/assertThrow');
const { hash } = require('eth-ens-namehash');
const deployDAO = require('./helpers/deployDAO');

const SharedAsset = artifacts.require('SharedAssetTestHelper.sol');
const ANY_ADDRESS = '0x0000000000000000000000000000000000000000';

const functionIds = { // This list has to be kept in sync with the TaskFunction enum order.
        CHANGE_APPROVAL_TRESHOLD: 0,
        CHANGE_ASSET_DESCRIPTION: 1,
        CHANGE_TREASURY_RATIO: 2,
        EXECUTE_EXTERNAL_CONTRACT: 3,
        ORIGINAL: 4,
        SEND_MONEY: 5
    };

contract('SharedAssetTestHelper', ([contractCreator, assetCreator, user1, user2]) => {
    let asset;
    
    beforeEach('Create asset instance', async () => {
        asset = await SharedAsset.new(assetCreator, "TestAsset", {from: assetCreator});
    });
    
    /*
     * Initialization tests.
     */
    it('Initialize with single owner having all shares', async () => {
        
        // Assert owner count.
        var count = await asset.getOwnersCount();
        assert.equal(count, 1);
        
        // Assert that the owner owns all shares.
        var owner = await asset.getOwnerAddressByIndex(0);1.
        var ownerShares = parseInt(await asset.getSharesByAddress(owner));
        assert.equal(ownerShares, parseInt(await asset.TOTAL_SHARES()));
    });
    
    it('Initializing account is the first owner', async () => {
        var owner = await asset.getOwnerAddressByIndex(0);
        assert.equal(owner, assetCreator);
    });
    
    it('Initialize with empty treasury', async () => {
        var treasuryBalance = parseInt(await asset.getTreasuryBalance());
        assert.equal(treasuryBalance, 0);
    });
    
   it('Initialize with 0 funds', async () => {
       assert.equal(await web3.eth.getBalance(asset.address), 0);
   });
    
    it('Initialize with given asset description', async () => {
        var assetDesc = await asset.getAssetDescription();
        assert.equal(assetDesc, "TestAsset");
    });
    
    /*
     * Internal functional function tests.
     */
    it('increaseShares increases shares', async () => {
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 0);
        await asset.callIncreaseShares(user1, 10);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 10);
        await asset.callIncreaseShares(user1, 20);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 30);
    });
    
    it('decreaseShares decreases shares', async () => {
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(assetCreator)), TOTAL_SHARES);
        await asset.callDecreaseShares(assetCreator, 10);
        assert.equal(parseInt(await asset.getSharesByAddress(assetCreator)), TOTAL_SHARES - 10);
        await asset.callDecreaseShares(assetCreator, 20);
        assert.equal(parseInt(await asset.getSharesByAddress(assetCreator)), TOTAL_SHARES - 30);
    });
    
    it('transferShares transfers shares', async () => {
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(assetCreator)), TOTAL_SHARES);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 0);
        await asset.callTransferShares(assetCreator, user1, 10);
        assert.equal(parseInt(await asset.getSharesByAddress(assetCreator)), TOTAL_SHARES - 10);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 10);
        await asset.callTransferShares(assetCreator, user1, 20);
        assert.equal(parseInt(await asset.getSharesByAddress(assetCreator)), TOTAL_SHARES - 30);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 30);
    });
    
    it('addOwner/removeOwner adds/removes an owner with the given number of shares', async () => {
        
        // Add user1 as owner.
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 0);
        assert.equal(parseInt(await asset.getOwnersCount()), 1);
        await asset.callAddOwner(user1, 10);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 10);
        assert.equal(parseInt(await asset.getOwnersCount()), 2);
        
        // Remove user1 as owner. This does not remove the owner's shares (internally only called when the owner has 0 shares).
        await asset.callRemoveOwner(user1);
        assert.equal(parseInt(await asset.getOwnersCount()), 1);
    });
    
    /*
     * External payment and payout tests.
     */
    it('External payments are distributed over the funds and treasury', async () => {
        
        // Calculate expected values.
        var payment = 1000;
        var treasuryRatioNum = parseInt(await asset.getTreasuryRatio());
        var treasuryRatioDenom = parseInt(await asset.TREASURY_RATIO_DENOMINATOR());
        var treasury = Math.floor(payment * treasuryRatioNum / treasuryRatioDenom);
        
        // Assert actual values.
        await asset.payment("test", {from: user1, value: 1000});
        assert.equal(parseInt(await asset.getTreasuryBalance()), treasury);
        assert.equal(parseInt(await web3.eth.getBalance(asset.address)), payment);
    });
    
    it('Payout to shareholders', async () => {
        
        // Transfer shares from creator to users to create multiple shareholders.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        var user1Shares = Math.floor(TOTAL_SHARES * 0.3);
        var user2Shares = Math.floor(TOTAL_SHARES * 0.2);
        var assetCreatorShares = TOTAL_SHARES - user1Shares - user2Shares;
        await asset.callTransferShares(assetCreator, user1, user1Shares);
        await asset.callTransferShares(assetCreator, user2, user2Shares);
        
        // Make a payment to the contract.
        var payment = 1e20;
        await asset.payment('InfoMessage', {from: user1, value: payment});
        
        // Calculate value that should be distributed among shareholders.
        var totalTreasury = payment * parseInt(await asset.getTreasuryRatio()) / parseInt(await asset.TREASURY_RATIO_DENOMINATOR());
        var totalPayout = payment - totalTreasury;
        
        // Store current balances.
        var assetBalance = parseInt(await web3.eth.getBalance(asset.address));
        var user1Balance = parseInt(await web3.eth.getBalance(user1));
        var user2Balance = parseInt(await web3.eth.getBalance(user2));
        var assetCreatorBalance = parseInt(await web3.eth.getBalance(assetCreator));
        
        // Request payouts.
        await asset.withdrawPayout({from: user1});
        await asset.withdrawPayout({from: user2});
        await asset.withdrawPayout({from: assetCreator});
        
        // Assert that the payments were made. The 1e15 wei (0.001 Eth) tolorance accounts for the gas price of the withdrawPayout function.
        assert.equal(parseInt(await web3.eth.getBalance(asset.address)), assetBalance - totalPayout);
        assert.equal(Math.abs(parseInt(await web3.eth.getBalance(user1)) - (user1Balance + totalPayout * user1Shares / TOTAL_SHARES)) < 1e15, true);
        assert.equal(Math.abs(parseInt(await web3.eth.getBalance(user2)) - (user2Balance + totalPayout * user2Shares / TOTAL_SHARES)) < 1e15, true);
        assert.equal(Math.abs(parseInt(await web3.eth.getBalance(assetCreator)) - (assetCreatorBalance + totalPayout * assetCreatorShares / TOTAL_SHARES)) < 1e15, true);
    });
    
    it('Add to treasury increases balance', async () => {
        var treasuryBalanceBefore = parseInt(await asset.getTreasuryBalance());
        await asset.treasuryDeposit('InfoMessage', {from: user1, value: 1000});
        var treasuryBalanceAfter = parseInt(await asset.getTreasuryBalance());
        assert.equal(treasuryBalanceAfter, treasuryBalanceBefore + 1000);
    });
    
    it('Add to treasury increases balance twice', async () => {
        var treasuryBalanceBefore = parseInt(await asset.getTreasuryBalance());
        await asset.treasuryDeposit('InfoMessage', {from: user1, value: 1000});
        var treasuryBalanceAfter1 = parseInt(await asset.getTreasuryBalance());
        assert.equal(treasuryBalanceAfter1, treasuryBalanceBefore + 1000);
        await asset.treasuryDeposit('InfoMessage', {from: user2, value: 500});
        var treasuryBalanceAfter2 = parseInt(await asset.getTreasuryBalance());
        assert.equal(treasuryBalanceAfter2, treasuryBalanceBefore + 1000 + 500);
    });
    
    /*
     * Selling and buying shares tests.
     */
    it('Create new sell offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        // Create sell offer.
        var numShares = 10;
        var price = 1000;
        var seller = assetCreator;
        await asset.offerToSell(numShares, price, ANY_ADDRESS, {from: seller});
        
        // Assert that the offer was made and that the creator now has shares on sale.
        assert.equal(parseInt(await asset.getOffersCount()), 1);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), numShares);
        
        // Assert that the offer contains the right properties.
        var sellOffer = await asset.getOffer(0);
        assert.equal(sellOffer.id, 0);
        assert.equal(sellOffer.offerType, "SELL");
        assert.equal(sellOffer.seller, seller);
        assert.equal(sellOffer.buyer, ANY_ADDRESS);
        assert.equal(sellOffer.shares, numShares);
        assert.equal(sellOffer.price, price);
        assert.equal(sellOffer.cancelled, false);
    });
    
    it('Create new buy offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        // Create buy offer.
        var numShares = 10;
        var price = 1000;
        var buyer = user1;
        await asset.offerToBuy(numShares, price, ANY_ADDRESS, {from: buyer, value: numShares * price});
        
        // Assert that the offer was made and that the creator still does not have shares on sale.
        assert.equal(parseInt(await asset.getOffersCount()), 1);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Assert that the offer contains the right properties.
        var buyOffer = await asset.getOffer(0);
        assert.equal(buyOffer.id, 0);
        assert.equal(buyOffer.offerType, "BUY");
        assert.equal(buyOffer.seller, ANY_ADDRESS);
        assert.equal(buyOffer.buyer, buyer);
        assert.equal(buyOffer.shares, numShares);
        assert.equal(buyOffer.price, price);
        assert.equal(buyOffer.cancelled, false);
    });
    
    it('Fill an entire existing sell offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        var numShares = 10;
        var price = 1000;
        var seller = assetCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create sell offer.
        await asset.offerToSell(numShares, price, ANY_ADDRESS, {from: seller});
        
        // Buy the sell offer.
        var sellerBalance = parseInt(await web3.eth.getBalance(seller));
        await asset.buyShares(0, numShares, {from: buyer, value: numShares * price});
        
        // Assert that the offer was completed.
        var sellOffer = await asset.getOffer(0);
        assert.equal(sellOffer.shares, 0);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES - numShares);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), numShares);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Assert that the seller was paid.
        assert.equal(parseInt(await web3.eth.getBalance(seller)), sellerBalance + numShares * price);
    });
    
    it('Fill a partial existing sell offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        var numSharesOnSale = 50;
        var numSharesBought = 10;
        var price = 1000;
        var seller = assetCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create sell offer.
        await asset.offerToSell(numSharesOnSale, price, ANY_ADDRESS, {from: seller});
        
        // Partially fill the sell offer.
        var sellerBalance = parseInt(await web3.eth.getBalance(seller));
        await asset.buyShares(0, numSharesBought, {from: buyer, value: numSharesBought * price});
        
        // Assert that the offer was partially completed.
        var sellOffer = await asset.getOffer(0);
        var sharesOnSale = numSharesOnSale - numSharesBought;
        assert.equal(sellOffer.shares, sharesOnSale);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES - numSharesBought);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), sharesOnSale);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), numSharesBought);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Assert that the seller was paid.
        assert.equal(parseInt(await web3.eth.getBalance(seller)), sellerBalance + numSharesBought * price);
    });
    
    it('Fill an entire existing buy offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        var numShares = 10;
        var price = 1000;
        var seller = assetCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create buy offer.
        await asset.offerToBuy(numShares, price, ANY_ADDRESS, {from: buyer, value: numShares * price});
        
        // Fill the buy offer.
        await asset.sellShares(0, numShares, {from: seller});
        
        // Assert that the offer was completed.
        var buyOffer = await asset.getOffer(0);
        assert.equal(buyOffer.shares, 0);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES - numShares);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), numShares);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
    });
    
    it('Fill a partial existing buy offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        var numSharesSold = 10;
        var numSharesOnBuy = 50;
        var price = 1000;
        var seller = assetCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create buy offer.
        await asset.offerToBuy(numSharesOnBuy, price, ANY_ADDRESS, {from: buyer, value: numSharesOnBuy * price});
        
        // Partially fill the buy offer.
        await asset.sellShares(0, numSharesSold, {from: seller});
        
        // Assert that the offer was partially completed.
        var buyOffer = await asset.getOffer(0);
        assert.equal(parseInt(buyOffer.shares), numSharesOnBuy - numSharesSold);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        assert.equal(parseInt(await asset.getSharesByAddress(seller)), TOTAL_SHARES - numSharesSold);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await asset.getSharesByAddress(buyer)), numSharesSold);
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(buyer)), 0);
    });
    
    it('Cancel sell offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        // Create sell offer.
        await asset.offerToSell(10, 1000, ANY_ADDRESS, {from: assetCreator});
        
        // Cancel buy offer.
        await asset.cancelOffer(0, {from: assetCreator});
        
        // Assert that the offer was cancelled.
        var sellOffer = await asset.getOffer(0);
        assert.equal(sellOffer.cancelled, true);
        
        // Assert that the owner of the sell offer no longer has shares for sale.
        assert.equal(parseInt(await asset.getSharesOnSaleByAddress(assetCreator)), 0);
        
    });
    
    it('Cancel buy offer', async () => {
        assert.equal(parseInt(await asset.getOffersCount()), 0);
        
        // Create buy offer.
        await asset.offerToBuy(10, 1000, ANY_ADDRESS, {from: user1, value: 10 * 1000});
        
        // Cancel buy offer.
        await asset.cancelOffer(0, {from: user1});
        
        // Assert that the offer was cancelled.
        var buyOffer = await asset.getOffer(0);
        assert.equal(buyOffer.cancelled, true);
    });
    
    /*
     * Voting tests.
     */
    it('Create new proposal', async () => {
        
        // Assert that no proposals exist.
        assert.equal(parseInt(await asset.getProposalsCount()), 0);
        assert.equal(parseInt(await asset.getActiveProposalsCount()), 0);
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = 1;
        var uintArg = 0;
        var stringArg = "";
        var addressArg = ANY_ADDRESS;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: assetCreator});
        
        // Assert that a new active proposal exists.
        assert.equal(parseInt(await asset.getProposalsCount()), 1);
        assert.equal(parseInt(await asset.getActiveProposalsCount()), 1);
        
        // Assert that this new proposal matches the made proposal.
        var proposal = await asset.getProposal(0);
        assert.equal(proposal.id, 0);
        assert.equal(proposal.owner, assetCreator);
        assert.equal(proposal.reason, reason);
        assert.equal(proposal.functionId, funcId);
        assert.equal(proposal.uintArg, uintArg);
        assert.equal(proposal.stringArg, stringArg);
        assert.equal(proposal.addressArg, addressArg);
        assert.equal(proposal.support, parseInt(await asset.getSharesByAddress(assetCreator)));
        assert.equal(proposal.creationDate <= currentTimeSec, true);
        assert.equal(proposal.expirationDate, expTimeSec);
        assert.equal(proposal.completionDate, 0);
        assert.equal(proposal.cancelled, false);
        
        // Assert that the new proposal matches the new active proposal (by id).
        var activeProposal = await asset.getActiveProposalByIndex(0);
        assert.equal(parseInt(proposal.id), parseInt(activeProposal.id));
    });
    
    it('Cancel proposal', async () => {
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = 1;
        var uintArg = 0;
        var stringArg = "";
        var addressArg = ANY_ADDRESS;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: assetCreator});
        
        // Cancel proposal.
        await asset.cancelProposal(0, {from: assetCreator});
        
        // Assert that the proposal is cancelled and deactivated, but not removed from the proposals list.
        var proposal = await asset.getProposal(0);
        assert.equal(proposal.cancelled, true);
        assert.equal(parseInt(await asset.getProposalsCount()), 1);
        assert.equal(parseInt(await asset.getActiveProposalsCount()), 0);
    });
    
    it('Support and revoke proposal', async () => {
        
        // Transfer shares from creator to user.
        var TOTAL_SHARES = parseInt(await asset.TOTAL_SHARES());
        var user1Shares = Math.floor(TOTAL_SHARES * 0.3);
        var user2Shares = Math.floor(TOTAL_SHARES * 0.2);
        var assetCreatorShares = TOTAL_SHARES - user1Shares - user2Shares;
        await asset.callTransferShares(assetCreator, user1, user1Shares);
        await asset.callTransferShares(assetCreator, user2, user2Shares);
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = 1;
        var uintArg = 0;
        var stringArg = "";
        var addressArg = ANY_ADDRESS;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: user1});
        
        // Assert that the proposal was generated with support from the proposal creator.
        var proposal = await asset.getProposal(0);
        assert.equal(proposal.support, user1Shares);
        
        // Add support from another user.
        await asset.supportProposal(proposal.id, {from: assetCreator});
        
        // Assert that the proposal's support has increased.
        proposal = await asset.getProposal(proposal.id);
        assert.equal(proposal.support, user1Shares + assetCreatorShares);
        
        // Revoke support for the proposal.
        await asset.revokeProposalSupport(proposal.id, {from: assetCreator});
        
        // Assert that the proposal's support has decreased.
        proposal = await asset.getProposal(proposal.id);
        assert.equal(proposal.support, user1Shares);
    });
    
    it('Execute proposal CHANGE_APPROVAL_TRESHOLD', async () => {
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = functionIds.CHANGE_APPROVAL_TRESHOLD;
        var uintArg = 10;
        var stringArg = "";
        var addressArg = ANY_ADDRESS;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: assetCreator});
        
        // Execute the proposal.
        await asset.executeProposal(0);
        
        // Assert that the approval threshold has changed.
        assert.equal(await asset.getProposalApprovalThreshold(), uintArg);
    });
    
    it('Execute proposal CHANGE_ASSET_DESCRIPTION', async () => {
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = functionIds.CHANGE_ASSET_DESCRIPTION;
        var uintArg = 0;
        var stringArg = "NewDescription";
        var addressArg = ANY_ADDRESS;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: assetCreator});
        
        // Execute the proposal.
        await asset.executeProposal(0);
        
        // Assert that the asset description has changed.
        assert.equal(await asset.getAssetDescription(), stringArg);
    });
    
    it('Execute proposal CHANGE_TREASURY_RATIO', async () => {
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = functionIds.CHANGE_TREASURY_RATIO;
        var uintArg = 15;
        var stringArg = "";
        var addressArg = ANY_ADDRESS;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: assetCreator});
        
        // Execute the proposal.
        await asset.executeProposal(0);
        
        // Assert that the treasury ratio has changed.
        assert.equal(await asset.getTreasuryRatio(), uintArg);
    });
    
    it('Execute proposal SEND_MONEY', async () => {
        
        // Put money into the treasury.
        await asset.treasuryDeposit('InfoMessage', {from: assetCreator, value: 1000});
        var treasuryBefore = parseInt(await asset.getTreasuryBalance());
        
        // Make a new proposal.
        var currentTimeSec = Math.round(new Date().getTime() / 1000);
        var reason = "reason";
        var expTimeSec = currentTimeSec + 300;
        var funcId = functionIds.SEND_MONEY;
        var uintArg = 1000;
        var stringArg = "";
        var addressArg = user1;
        await asset.makeProposal(reason, expTimeSec, funcId,
                uintArg, stringArg, addressArg, {from: assetCreator});
        
        // Execute the proposal.
        await asset.executeProposal(0);
        
        // Assert that the money has been removed from the treasury.
        var treasuryAfter = parseInt(await asset.getTreasuryBalance());
        assert.equal(treasuryAfter, treasuryBefore - uintArg);
    });
});
