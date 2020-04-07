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

contract('AssetShareAppTestHelper', ([contractCreator, appManager, user1, user2]) => {
    let appBase, app;
    
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
        
        await app.initialize({from: contractCreator});
    });
    
    it('Initialize with single owner having all shares', async () => {
        
        // Assert owner count.
        var count = await app.getOwnersCount();
        assert.equal(count, 1);
        
        // Assert that the owner owns all shares.
        var owner = await app.getOwnerAddressByIndex(0);1.
        var ownerShares = parseInt(await app.getSharesByAddress(owner));
        assert.equal(ownerShares, parseInt(await app.TOTAL_SHARES()));
    });
    
    it('Initializing account is the first owner', async () => {
        var owner = await app.getOwnerAddressByIndex(0);
        assert.equal(owner, contractCreator);
    });
    
    it('Initialize with empty treasury', async () => {
        var treasuryBalance = parseInt(await app.getTreasuryBalance());
        assert.equal(treasuryBalance, 0);
    });
    
    it('Initialize with 0 funds', async () => {
        var funds = parseInt(await app.getFunds());
        assert.equal(funds, 0);
    });
    
    it('Initialize with empty asset description', async () => {
        var assetDesc = await app.getAssetDescription();
        assert.equal(assetDesc, "");
    });
    
    it('increaseShares increases shares', async () => {
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 0);
        await app.callIncreaseShares(user1, 10);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 10);
        await app.callIncreaseShares(user1, 20);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 30);
    });
    
    it('decreaseShares decreases shares', async () => {
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(contractCreator)), TOTAL_SHARES);
        await app.callDecreaseShares(contractCreator, 10);
        assert.equal(parseInt(await app.getSharesByAddress(contractCreator)), TOTAL_SHARES - 10);
        await app.callDecreaseShares(contractCreator, 20);
        assert.equal(parseInt(await app.getSharesByAddress(contractCreator)), TOTAL_SHARES - 30);
    });
    
    it('transferShares transfers shares', async () => {
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(contractCreator)), TOTAL_SHARES);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 0);
        await app.callTransferShares(contractCreator, user1, 10);
        assert.equal(parseInt(await app.getSharesByAddress(contractCreator)), TOTAL_SHARES - 10);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 10);
        await app.callTransferShares(contractCreator, user1, 20);
        assert.equal(parseInt(await app.getSharesByAddress(contractCreator)), TOTAL_SHARES - 30);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 30);
    });
    
    it('addOwner/removeOwner adds/removes an owner with the given number of shares', async () => {
        
        // Add user1 as owner.
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 0);
        assert.equal(parseInt(await app.getOwnersCount()), 1);
        await app.callAddOwner(user1, 10);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 10);
        assert.equal(parseInt(await app.getOwnersCount()), 2);
        
        // Remove user1 as owner.
        await app.callRemoveOwner(user1);
        assert.equal(parseInt(await app.getSharesByAddress(user1)), 0);
        assert.equal(parseInt(await app.getOwnersCount()), 1);
    });
    
    it('External payments are distributed over the funds and treasury', async () => {
        
        // Calculate expected values.
        var payment = 1000;
        var treasuryRatioNum = parseInt(await app.getTreasuryRatio());
        var treasuryRatioDenom = parseInt(await app.TREASURY_RATIO_DENOMINATOR());
        var treasury = Math.floor(payment * treasuryRatioNum / treasuryRatioDenom);
        
        // Assert actual values.
        await app.payment("test", {from: user1, value: 1000});
        assert.equal(parseInt(await app.getTreasuryBalance()), treasury);
        assert.equal(parseInt(await app.getFunds()), payment - treasury);
    });
    
//    it('Payout to owners', async () => {
//        
//        // Deposit money into the treasury.
//        await app.treasuryDeposit('InfoMessage', {from: user1, value: 1e12});
//        
//        // Payout to the shareholders.
//        var currentTimeSec = Date.now() / 1000;
//        await app.payOwners({timestamp: currentTimeSec + parseInt(await app.payoutPeriod)});
//        
//        // Assert that the owners have received the payout.
//        // TODO - How to get Ether from address?
//    });
    
    it('Add to treasury increases balance', async () => {
        var treasuryBalanceBefore = parseInt(await app.getTreasuryBalance());
        await app.treasuryDeposit('InfoMessage', {from: user1, value: 1000});
        var treasuryBalanceAfter = parseInt(await app.getTreasuryBalance());
        assert.equal(treasuryBalanceAfter, treasuryBalanceBefore + 1000);
    });
    
    it('Add to treasury increases balance twice', async () => {
        var treasuryBalanceBefore = parseInt(await app.getTreasuryBalance());
        await app.treasuryDeposit('InfoMessage', {from: user1, value: 1000});
        var treasuryBalanceAfter1 = parseInt(await app.getTreasuryBalance());
        assert.equal(treasuryBalanceAfter1, treasuryBalanceBefore + 1000);
        await app.treasuryDeposit('InfoMessage', {from: user2, value: 500});
        var treasuryBalanceAfter2 = parseInt(await app.getTreasuryBalance());
        assert.equal(treasuryBalanceAfter2, treasuryBalanceBefore + 1000 + 500);
    });
    
    it('Create new sell offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        // Create sell offer.
        var numShares = 10;
        var price = 1000;
        var seller = contractCreator;
        await app.offerToSell(numShares, price, ANY_ADDRESS, {from: seller});
        
        // Assert that the offer was made and that the creator now has shares on sale.
        assert.equal(parseInt(await app.getOffersCount()), 1);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), numShares);
        
        // Assert that the offer contains the right properties.
        var sellOffer = await app.getOffer(0);
        assert.equal(sellOffer.id, 0);
        assert.equal(sellOffer.offerType, "SELL");
        assert.equal(sellOffer.seller, seller);
        assert.equal(sellOffer.buyer, ANY_ADDRESS);
        assert.equal(sellOffer.shares, numShares);
        assert.equal(sellOffer.price, price);
        assert.equal(sellOffer.cancelled, false);
    });
    
    it('Create new buy offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        // Create buy offer.
        var numShares = 10;
        var price = 1000;
        var buyer = user1;
        await app.offerToBuy(numShares, price, ANY_ADDRESS, {from: buyer, value: numShares * price});
        
        // Assert that the offer was made and that the creator still does not have shares on sale.
        assert.equal(parseInt(await app.getOffersCount()), 1);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
        
        // Assert that the offer contains the right properties.
        var buyOffer = await app.getOffer(0);
        assert.equal(buyOffer.id, 0);
        assert.equal(buyOffer.offerType, "BUY");
        assert.equal(buyOffer.seller, ANY_ADDRESS);
        assert.equal(buyOffer.buyer, buyer);
        assert.equal(buyOffer.shares, numShares);
        assert.equal(buyOffer.price, price);
        assert.equal(buyOffer.cancelled, false);
    });
    
    it('Fill an entire existing sell offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        var numShares = 10;
        var price = 1000;
        var seller = contractCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create sell offer.
        await app.offerToSell(numShares, price, ANY_ADDRESS, {from: seller});
        
        // Buy the sell offer.
        await app.buyShares(0, numShares, {from: buyer, value: numShares * price});
        
        // Assert that the offer was completed.
        var sellOffer = await app.getOffer(0);
        assert.equal(sellOffer.shares, 0);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES - numShares);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), numShares);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
    });
    
    it('Fill a partial existing sell offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        var numSharesOnSale = 50;
        var numSharesBought = 10;
        var price = 1000;
        var seller = contractCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create sell offer.
        await app.offerToSell(numSharesOnSale, price, ANY_ADDRESS, {from: seller});
        
        // Partially fill the sell offer.
        await app.buyShares(0, numSharesBought, {from: buyer, value: numSharesBought * price});
        
        // Assert that the offer was partially completed.
        var sellOffer = await app.getOffer(0);
        var sharesOnSale = numSharesOnSale - numSharesBought;
        assert.equal(sellOffer.shares, sharesOnSale);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES - numSharesBought);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), sharesOnSale);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), numSharesBought);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
    });
    
    it('Fill an entire existing buy offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        var numShares = 10;
        var price = 1000;
        var seller = contractCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create buy offer.
        await app.offerToBuy(numShares, price, ANY_ADDRESS, {from: buyer, value: numShares * price});
        
        // Fill the buy offer.
        await app.sellShares(0, numShares, {from: seller});
        
        // Assert that the offer was completed.
        var buyOffer = await app.getOffer(0);
        assert.equal(buyOffer.shares, 0);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES - numShares);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), numShares);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
    });
    
    it('Fill a partial existing buy offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        var numSharesSold = 10;
        var numSharesOnBuy = 50;
        var price = 1000;
        var seller = contractCreator;
        var buyer = user1;
        
        // Assert initial shares state.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
        
        // Create buy offer.
        await app.offerToBuy(numSharesOnBuy, price, ANY_ADDRESS, {from: buyer, value: numSharesOnBuy * price});
        
        // Partially fill the buy offer.
        await app.sellShares(0, numSharesSold, {from: seller});
        
        // Assert that the offer was partially completed.
        var buyOffer = await app.getOffer(0);
        assert.equal(parseInt(buyOffer.shares), numSharesOnBuy - numSharesSold);
        
        // Assert that the shares were transferred.
        var TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES - numSharesSold);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), numSharesSold);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
    });
    
    it('Cancel sell offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        // Create sell offer.
        await app.offerToSell(10, 1000, ANY_ADDRESS, {from: contractCreator});
        
        // Cancel buy offer.
        await app.cancelOffer(0, {from: contractCreator});
        
        // Assert that the offer was cancelled.
        var sellOffer = await app.getOffer(0);
        assert.equal(sellOffer.cancelled, true);
        
        // Assert that the owner of the sell offer no longer has shares for sale.
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(contractCreator)), 0);
        
    });
    
    it('Cancel buy offer', async () => {
        assert.equal(parseInt(await app.getOffersCount()), 0);
        
        // Create buy offer.
        await app.offerToBuy(10, 1000, ANY_ADDRESS, {from: user1, value: 10 * 1000});
        
        // Cancel buy offer.
        await app.cancelOffer(0, {from: user1});
        
        // Assert that the offer was cancelled.
        var buyOffer = await app.getOffer(0);
        assert.equal(buyOffer.cancelled, true);
    });
});
