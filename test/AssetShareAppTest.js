/* global artifacts contract beforeEach it assert */

const { assertRevert } = require('@aragon/test-helpers/assertThrow');
const { hash } = require('eth-ens-namehash');
const deployDAO = require('./helpers/deployDAO');

const AssetShareApp = artifacts.require('AssetShareAppTestHelper.sol');
const ANY_ADDRESS = '0x0000000000000000000000000000000000000000';

const getLog = (receipt, logName, argName) => {
    const log = receipt.logs.find(({ event }) => event === logName);
    return log ? log.args[argName] : null;
}

const deployedContract = receipt => getLog(receipt, 'NewAppProxy', 'proxy');

contract('AssetShareAppTestHelper', ([appManager, assetCreator, user1, user2]) => {
    let appBase, app, asset;
    
    // eslint-disable-next-line no-undef
    before('deploy base app', async () => {
        // Deploy the app's base contract.
        appBase = await AssetShareApp.new();
    });
    
    beforeEach('deploy dao and app', async () => {
        const { dao, acl } = await deployDAO(appManager);
        
        // Instantiate a proxy for the app, using the base contract as its logic implementation.
        const newAppInstanceReceipt = await dao.newAppInstance(
            hash('foo.aragonpm.test'), // appId - Unique identifier for each app installed in the DAO; can be any bytes32 string in the tests.
            appBase.address,           // appBase - Location of the app's base implementation.
            '0x',                      // initializePayload - Used to instantiate and initialize the proxy in the same call (if given a non-empty bytes string).
            false,                     // setDefault - Whether the app proxy is the default proxy.
            { from: appManager }
        );
        app = await AssetShareApp.at(deployedContract(newAppInstanceReceipt));
        
        await app.initialize({from: appManager});
        
        // Create SharedAsset instance.
        await app.createAssetHelper("TestAsset", {from: assetCreator});
        asset = await app.getAssetByIdx(0);
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
        var funds = parseInt(await asset.getFunds());
        assert.equal(funds, 0);
    });
    
    it('Initialize with empty asset description', async () => {
        var assetDesc = await asset.getAssetDescription();
        assert.equal(assetDesc, "");
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
        
        // Remove user1 as owner.
        await asset.callRemoveOwner(user1);
        assert.equal(parseInt(await asset.getSharesByAddress(user1)), 0);
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
        assert.equal(parseInt(await asset.getFunds()), payment - treasury);
    });
    
//    it('Payout to owners', async () => {
//        
//        // Deposit money into the treasury.
//        await asset.treasuryDeposit('InfoMessage', {from: user1, value: 1e12});
//        
//        // Payout to the shareholders.
//        var currentTimeSec = Date.now() / 1000;
//        await asset.payOwners({timestamp: currentTimeSec + parseInt(await asset.payoutPeriod)});
//        
//        // Assert that the owners have received the payout.
//        // TODO - How to get Ether from address?
//    });
    
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
});
