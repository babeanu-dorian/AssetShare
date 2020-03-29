/* global artifacts contract beforeEach it assert */

const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const deployDAO = require('./helpers/deployDAO')

const AssetShareApp = artifacts.require('AssetShareAppHelper.sol')

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'
const ADDRESS_1 = '0x0000000000000000000000000000000000000001'
const ADDRESS_2 = '0x0000000000000000000000000000000000000002'
const ADDRESS_3 = '0x0000000000000000000000000000000000000003'

const getLog = (receipt, logName, argName) => {
    const log = receipt.logs.find(({ event }) => event === logName)
    return log ? log.args[argName] : null
}

const deployedContract = receipt => getLog(receipt, 'NewAppProxy', 'proxy')

contract('AssetShareAppHelper', ([contractCreator, appManager, user1, user2]) => {
    let appBase, app
    
    // eslint-disable-next-line no-undef
    before('deploy base app', async () => {
        // Deploy the app's base contract.
        appBase = await AssetShareApp.new()
    })
    
    beforeEach('deploy dao and app', async () => {
        const { dao, acl } = await deployDAO(appManager)
        
        // Instantiate a proxy for the app, using the base contract as its logic implementation.
        const newAppInstanceReceipt = await dao.newAppInstance(
            hash('foo.aragonpm.test'), // appId - Unique identifier for each app installed in the DAO; can be any bytes32 string in the tests.
            appBase.address, // appBase - Location of the app's base implementation.
            '0x', // initializePayload - Used to instantiate and initialize the proxy in the same call (if given a non-empty bytes string).
            false, // setDefault - Whether the app proxy is the default proxy.
            { from: appManager }
        )
        app = await AssetShareApp.at(deployedContract(newAppInstanceReceipt))
        
        // Set up the app's permissions.
        // await acl.createPermission(
            // ANY_ADDRESS, // entity (who?) - The entity or address that will have the permission.
            // app.address, // app (where?) - The app that holds the role involved in this permission.
            // INCREMENT_ROLE, // role (what?) - The particular role that the entity is being assigned to in this permission.
            // appManager, // manager - Can grant/revoke further permissions for this role.
            // { from: appManager }
        // )
        // await acl.createPermission(
            // ANY_ADDRESS,
            // app.address,
            // DECREMENT_ROLE,
            // appManager,
            // { from: appManager }
        // )

        await app.initialize({from: contractCreator});
    })
    
    it('Initialize with single owner having all shares', async () => {
        
        // Assert owner count.
        var count = await app.getOwnersCount();
        assert.equal(count, 1);
        
        // Assert that the owner owns all shares.
        var owner = await app.getOwnerAddressByIndex(0);
        var ownerShares1 = parseInt(await app.getShares({from: owner})); // Getter option 1.
        var ownerShares2 = parseInt(await app.getSharesByAddress(owner)); // Getter option 2.
        assert.equal(ownerShares1, parseInt(await app.TOTAL_SHARES()));
        assert.equal(ownerShares2, parseInt(await app.TOTAL_SHARES()));
    });
    
    it('Initializing account is the first owner', async () => {
        var owner = await app.getOwnerAddressByIndex(0);
        assert.equal(owner, contractCreator);
    });
    
    it('Initialize with empty treasury', async () => {
        var treasuryBalance = parseInt(await app.getTreasuryBalance());
        assert.equal(treasuryBalance, 0);
    });
    
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
    
    it('Testing to see if we can call internal functions', async () => {
        
        await app.callAddOwner(ADDRESS_1, 0);
    });
    
    it('New sell offer autocompletes equal buy offer', async () => {
        
        // Define a seller (the initial owner) and a random buyer.
        var seller = await app.getOwnerAddressByIndex(0);
        var buyer = user1;
        
        // Assert initial shares state.
        const TOTAL_SHARES = parseInt(await app.TOTAL_SHARES());
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), 0);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), 0);
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(buyer)), 0);
        
        // Assert that there are no active offers.
        assert.equal(parseInt(await app.getActiveBuyOffersCount()), 0);
        assert.equal(parseInt(await app.getActiveSellOffersCount()), 0);
        
        // Create the sell offer.
        var numShares = 20;
        var price = 1000;
        await app.offerToSell(numShares, price, {from: seller});
        var sellOfferId = parseInt(await app.getLatestOfferId());
        
        // Assert that the seller now has shares for sale.
        assert.equal(parseInt(await app.getSharesOnSaleByAddress(seller)), numShares);
        
        // Create buy offer.
        await app.offerToBuy(numShares, price, {from: buyer, value: numShares * price});
        var buyOfferId = parseInt(await app.getLatestOfferId());
        
        // Assert that the buyer has sent (price * numShares) wei to the contract.
        // TODO - Implement. Can maybe use transaction details returned by the payable function?
        
        // Assert that the seller has lost and the buyer has obtained the shares (and therefore is an owner).
        assert.equal(parseInt(await app.getSharesByAddress(seller)), TOTAL_SHARES - numShares);
        assert.equal(parseInt(await app.getSharesByAddress(buyer)), numShares);
        
        // Assert that both offers are completed, but are not yet collected.
        var sellOffer = await app.getOffer(sellOfferId);
        var buyOffer = await app.getOffer(buyOfferId);
        assert.equal(sellOffer.sharesRemaining, 0);
        assert.equal(buyOffer.sharesRemaining, 0);
        assert.equal(sellOffer.weiAmount, numShares * price);
        assert.equal(buyOffer.weiAmount, 0);
        assert.equal(sellOffer.cancelled, false);
        assert.equal(buyOffer.cancelled, false);
        
        // Collect the offers.
        await app.collectOffer(sellOfferId, {from: seller});
        await app.collectOffer(buyOfferId, {from: buyer});
        
        // Assert that the offers have been collected.
        sellOffer = await app.getOffer(sellOfferId);
        buyOffer = await app.getOffer(buyOfferId);
        assert.equal(sellOffer.cancelled, true);
        assert.equal(buyOffer.cancelled, true);
        
        // Assert that collecting the sell offer sends (price * numShares) wei to the seller.
        // TODO - Implement. How to get the transferred funds?
        
    });
    
    // it('should be incremented by any address', async () => {
        // await app.increment(1, { from: user })
        // assert.equal(await app.value(), 1)
    // })
    
    // it('should not be decremented if already 0', async () => {
        // await assertRevert(app.decrement(1), 'MATH_SUB_UNDERFLOW')
    // })
})
