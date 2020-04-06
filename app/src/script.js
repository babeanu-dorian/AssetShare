import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, {events} from '@aragon/api'
import assetJsonInterface from './SharedAssetInterface'

const app = new Aragon()
/*
app.store(
    async (state, event) => {
        const nextState = {
            ...state,
        }
        try {
            switch (event.event) {
                case 'PAYMENT_RECEIVED':
                    return {
                        ...nextState,
                        treasuryBalance: await getTreasuryBalance(),
                        funds: await getFunds()
                    }
                case 'TREASURY_DEPOSIT':
                    return {
                        ...nextState,
                        treasuryBalance: await getTreasuryBalance()
                    }
                case 'OWNERS_PAID':
                    return {
                        ...nextState,
                        funds: await getFunds()
                    }
                case 'NEW_OFFER':
                case 'SHARES_TRANSFERED':
                case 'CANCELLED_OFFER':
                    return {
                        ...nextState,
                        owners: await getOwners(),
                        offers: await getActiveOffers()
                    }
                case 'NEW_PROPOSAL':
                case 'CANCELLED_PROPOSAL':
                case 'VOTE':
                    return {
                        ...nextState,
                        proposals: await getActiveProposals(),
                        supportedProposals: await getSupportedProposals(state.currentUser)
                    }
                case 'EXECUTED_PROPOSAL':
                    return {
                        ...nextState,
                        assetDescription: await getAssetDescription(),
                        treasuryRatio: await getTreasuryRatio(),
                        payoutPeriod: await getPayoutPeriod(),
                        proposalApprovalThreshold: await getProposalApprovalThreshold(),
                        treasuryBalance: await getTreasuryBalance(),
                        proposals: await getActiveProposals(),
                        supportedProposals: await getSupportedProposals(state.currentUser)
                    }
                case 'REMOVED_SUPPORTED_PROPOSAL':
                    return {
                        ...nextState,
                        supportedProposals: await getSupportedProposals(state.currentUser)
                    }
                case 'ACCOUNTS_TRIGGER':
                    return {
                        ...nextState,
                        currentUser: event.returnValues.account,
                        supportedProposals: await getSupportedProposals(event.returnValues.account)
                    }
                case events.SYNC_STATUS_SYNCING:
                    return {...nextState, isSyncing: true}
                case events.SYNC_STATUS_SYNCED:
                    return {...nextState, isSyncing: false}
                default:
                    return state
            }
        } catch (err) {
            console.log(err)
        }
    },
    {
        init: initializeState(),
    }
)
*/

var selectedAsset = null;

app.store(
    async (state, event) => {
        const nextState = {
            ...state,
        }
        try {
            console.log(event);
            switch (event.event) {
                case 'NEW_ASSET':
                    return {
                        ...nextState,
                        sharedAssets: await getSharedAssets()
                    }
                case 'ASSET_SELECTED':
                    selectedAsset = app.external(event.returnValues.address, assetJsonInterface);
                    return {
                        ...nextState,
                        assetDescription: await getAssetDescription(),
                        treasuryBalance: await getTreasuryBalance(),
                        funds: await getFunds()
                    }
                case 'PAYMENT_RECEIVED':
                    return {
                        ...nextState,
                        treasuryBalance: await getTreasuryBalance(),
                        funds: await getFunds()
                    }
                case 'TREASURY_DEPOSIT':
                    return {
                        ...nextState,
                        treasuryBalance: await getTreasuryBalance()
                    }
                case 'OWNERS_PAID':
                    return {
                        ...nextState,
                        funds: await getFunds()
                    }
                case 'NEW_OFFER':
                case 'SHARES_TRANSFERED':
                case 'CANCELLED_OFFER':
                    return {
                        ...nextState,
                        owners: await getOwners(),
                        offers: await getActiveOffers()
                    }
                case events.SYNC_STATUS_SYNCING:
                    return {...nextState, isSyncing: true}
                case events.SYNC_STATUS_SYNCED:
                    return {...nextState, isSyncing: false}
                default:
                    return state
            }
        } catch (err) {
            console.log(err)
        }
    },
    {
        init: initializeState(),
    }
)

/***********************
 *                     *
 *   Event Handlers    *
 *                     *
 ***********************/

function initializeState() {
    return async cachedState => {
        return {
            ...cachedState,
            sharedAssets: await getSharedAssets(),
            assetDescription: '',
            treasuryBalance: 0,
            funds: 0
        }
    }
}

async function getSharedAssets() {
    let assetCount = parseInt(await app.call('getAssetCount').toPromise(), 10);
    let sharedAssets = [];
    for (let i = 0; i != assetCount; ++i) {
        sharedAssets.push(await app.call('getAssetByIdx', i).toPromise());
    }
    return sharedAssets;
}

async function getAssetDescription() {
    let tmp = await selectedAsset.getAssetDescription().toPromise();
    console.log(tmp);
    return tmp;
}

async function getTreasuryBalance() {
    return parseInt(await selectedAsset.getTreasuryBalance().toPromise(), 10);
}

async function getFunds() {
    return parseInt(await selectedAsset.getFunds().toPromise(), 10);
}

async function getOwners() {
    let ownersCount = parseInt(await selectedAsset.call('getOwnersCount').toPromise(), 10);
    let owners = [];
    for (let i = 0; i != ownersCount; ++i) {
        let address = await selectedAsset.call('getOwnerAddressByIndex', i).toPromise();
        owners.push({
            'address': address,
            'shares': parseInt(await selectedAsset.call('getSharesByAddress', address).toPromise(), 10),
            'sharesOnSale': parseInt(await selectedAsset.call('getSharesOnSaleByAddress', address).toPromise(), 10)
        });
    }
    return owners;
}

async function getActiveOffers() {
    let offersCount = parseInt(await selectedAsset.call('getActiveOffersCount').toPromise(), 10);
    let offers = {
        sellOffers: [],
        buyOffers: []
    };
    for (let i = 0; i != offersCount; ++i) {
        let offer = await selectedAsset.call('getActiveOfferByIndex', i).toPromise();
        if (offer.offerType == 'SELL') {
            offers.sellOffers.push(offer);
        } else {
            offers.buyOffers.push(offer);
        }
    }

    // sort sell offers in increasing price order
    offers.sellOffers.sort((a, b) => parseInt(a.price) - parseInt(b.price));

    // sort buy offers in decreasing price order
    offers.buyOffers.sort((a, b) => parseInt(b.price) - parseInt(a.price));

    return offers;
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/*
function initializeState() {
    return async cachedState => {
        return {
            ...cachedState,
            TOTAL_SHARES: await getTotalShares(),
            TREASURY_RATIO_DENOMINATOR: await getTreasuryRatioDenominator(),
            functionIds: await getTaskFunctionValues(),
            currentUser: '',
            assetDescription: await getAssetDescription(),
            treasuryRatio: await getTreasuryRatio(),
            payoutPeriod: await getPayoutPeriod(),
            proposalApprovalThreshold: await getProposalApprovalThreshold(),
            treasuryBalance: await getTreasuryBalance(),
            funds: await getFunds(),
            owners: await getOwners(),
            offers: await getActiveOffers(),
            proposals: await getActiveProposals(),
            supportedProposals: []
        }
    }
}


async function getTotalShares() {
    return parseInt(await app.call('TOTAL_SHARES').toPromise(), 10);
}

async function getTreasuryRatioDenominator() {
    return parseInt(await app.call('TREASURY_RATIO_DENOMINATOR').toPromise(), 10);
}

async function getTaskFunctionValues() {
    return await app.call('getTaskFunctionValues').toPromise();
}

async function getTreasuryRatio() {
    return await app.call('getTreasuryRatio').toPromise();
}

async function getPayoutPeriod() {
    return await app.call('getPayoutPeriod').toPromise();
}

async function getProposalApprovalThreshold() {
    return await app.call('getProposalApprovalThreshold').toPromise();
}

async function getOwners() {
    let ownersCount = parseInt(await app.call('getOwnersCount').toPromise(), 10);
    let owners = [];
    for (let i = 0; i != ownersCount; ++i) {
        let address = await app.call('getOwnerAddressByIndex', i).toPromise();
        owners.push({
            'address': address,
            'shares': parseInt(await app.call('getSharesByAddress', address).toPromise(), 10),
            'sharesOnSale': parseInt(await app.call('getSharesOnSaleByAddress', address).toPromise(), 10)
        });
    }
    return owners;
}

async function getActiveOffers() {
    let offersCount = parseInt(await app.call('getActiveOffersCount').toPromise(), 10);
    let offers = {
        sellOffers: [],
        buyOffers: []
    };
    for (let i = 0; i != offersCount; ++i) {
        let offer = await app.call('getActiveOfferByIndex', i).toPromise();
        if (offer.offerType == 'SELL') {
            offers.sellOffers.push(offer);
        } else {
            offers.buyOffers.push(offer);
        }
    }

    // sort sell offers in increasing price order
    offers.sellOffers.sort((a, b) => parseInt(a.price) - parseInt(b.price));

    // sort buy offers in decreasing price order
    offers.buyOffers.sort((a, b) => parseInt(b.price) - parseInt(a.price));

    return offers;
}

async function getActiveProposals() {
    let count = parseInt(await app.call('getActiveProposalsCount').toPromise(), 10);
    let proposals = [];
    for (let i = 0; i != count; ++i) {
        proposals.push(await app.call('getActiveProposalByIndex', i).toPromise());
    }
    return proposals;
}

async function getSupportedProposals(owner) {

    if (!owner) return [];

    let count = parseInt(await app.call('getSupportedProposalsCount', owner).toPromise(), 10);
    let proposals = [];
    for (let i = 0; i != count; ++i) {
        let id = parseInt(await app.call('getSupportedProposalIdByIndex', owner, i).toPromise(), 10);
        let proposal = await app.call('getProposal', id).toPromise();
        proposal.idx = i;
        proposals.push(proposal);
    }
    return proposals;
}
*/