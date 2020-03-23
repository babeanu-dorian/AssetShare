/* global artifacts contract beforeEach it assert */

const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const deployDAO = require('./helpers/deployDAO')

const AssetShareApp = artifacts.require('AssetShareApp.sol')

const ANY_ADDRESS = '0xffffffffffffffffffffffffffffffffffffffff'
const ADDRESS_1 = '0x0000000000000000000000000000000000000001'
const ADDRESS_2 = '0x0000000000000000000000000000000000000002'
const ADDRESS_3 = '0x0000000000000000000000000000000000000003'

const getLog = (receipt, logName, argName) => {
    const log = receipt.logs.find(({ event }) => event === logName)
    return log ? log.args[argName] : null
}

const deployedContract = receipt => getLog(receipt, 'NewAppProxy', 'proxy')

contract('AssetShareApp', ([appManager, user1, user2]) => {
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

        await app.initialize()
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
    
    it('Payout to owners', async () => {
        
        // Deposit money into the treasury.
        await app.treasuryDeposit('InfoMessage', {from: user1, value: 1e12});
        
        // Payout to the shareholders.
        var currentTimeSec = Date.now() / 1000;
        await app.payOwners({timestamp: currentTimeSec + parseInt(await app.payoutPeriod)});
        
        // Assert that the owners have received the payout.
        // TODO - How to get Ether from address?
    });
    
    // it('should be incremented by any address', async () => {
        // await app.increment(1, { from: user })
        // assert.equal(await app.value(), 1)
    // })
    
    // it('should not be decremented if already 0', async () => {
        // await assertRevert(app.decrement(1), 'MATH_SUB_UNDERFLOW')
    // })
})
