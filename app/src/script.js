import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, {events} from '@aragon/api'
import assetJsonInterface from './SharedAssetInterface'

const app = new Aragon()

var selectedAsset = null;

app.store(
    async (state, event) => {
        const nextState = {
            ...state,
        }
        try {
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
                        TOTAL_SHARES: await getTotalShares(),
                        TREASURY_RATIO_DENOMINATOR: await getTreasuryRatioDenominator(),
                        functionIds: await getTaskFunctionValues(),
                        assetDescription: await getAssetDescription(),
                        treasuryRatio: await getTreasuryRatio(),
                        payoutPeriod: await getPayoutPeriod(),
                        proposalApprovalThreshold: await getProposalApprovalThreshold(),
                        treasuryBalance: await getTreasuryBalance(),
                        funds: await getFunds(),
                        owners: await getOwners(),
                        offers: await getActiveOffers(),
                        proposals: await getActiveProposals(),
                        supportedProposals: await getSupportedProposals(state.currentUser)
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

function initializeState() {
    return async cachedState => {
        return {
            ...cachedState,
            sharedAssets: await getSharedAssets(),
            TOTAL_SHARES: 0,
            TREASURY_RATIO_DENOMINATOR: 0,
            functionIds: {},
            currentUser: '',
            assetDescription: '',
            treasuryRatio: 0,
            payoutPeriod: 0,
            proposalApprovalThreshold: 0,
            treasuryBalance: 0,
            funds: 0,
            owners: [],
            offers: {
                sellOffers: [],
                buyOffers: []
            },
            proposals: [],
            supportedProposals: []
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
    return await selectedAsset.getAssetDescription().toPromise();
}

async function getTotalShares() {
    return parseInt(await selectedAsset.TOTAL_SHARES().toPromise(), 10);
}

async function getTreasuryRatioDenominator() {
    return parseInt(await selectedAsset.TREASURY_RATIO_DENOMINATOR().toPromise(), 10);
}

async function getTaskFunctionValues() {
    return await selectedAsset.getTaskFunctionValues().toPromise();
}

async function getTreasuryRatio() {
    return await selectedAsset.getTreasuryRatio().toPromise();
}

async function getPayoutPeriod() {
    return await selectedAsset.getPayoutPeriod().toPromise();
}

async function getProposalApprovalThreshold() {
    return await selectedAsset.getProposalApprovalThreshold().toPromise();
}

async function getTreasuryBalance() {
    return parseInt(await selectedAsset.getTreasuryBalance().toPromise(), 10);
}

async function getFunds() {
    return parseInt(await selectedAsset.getFunds().toPromise(), 10);
}

async function getOwners() {
    let ownersCount = parseInt(await selectedAsset.getOwnersCount().toPromise(), 10);
    let owners = [];
    for (let i = 0; i != ownersCount; ++i) {
        let address = await selectedAsset.getOwnerAddressByIndex(i).toPromise();
        owners.push({
            'address': address,
            'shares': parseInt(await selectedAsset.getSharesByAddress(address).toPromise(), 10),
            'sharesOnSale': parseInt(await selectedAsset.getSharesOnSaleByAddress(address).toPromise(), 10)
        });
    }
    return owners;
}

async function getActiveOffers() {
    let offersCount = parseInt(await selectedAsset.getActiveOffersCount().toPromise(), 10);
    let offers = {
        sellOffers: [],
        buyOffers: []
    };
    for (let i = 0; i != offersCount; ++i) {
        let offer = await selectedAsset.getActiveOfferByIndex(i).toPromise();
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
    let count = parseInt(await selectedAsset.getActiveProposalsCount().toPromise(), 10);
    let proposals = [];
    for (let i = 0; i != count; ++i) {
        proposals.push(await selectedAsset.getActiveProposalByIndex(i).toPromise());
    }
    return proposals;
}

async function getSupportedProposals(owner) {

    if (!owner || !selectedAsset) return [];

    let count = parseInt(await selectedAsset.getSupportedProposalsCount(owner).toPromise(), 10);
    let proposals = [];
    for (let i = 0; i != count; ++i) {
        let id = parseInt(await selectedAsset.getSupportedProposalIdByIndex(owner, i).toPromise(), 10);
        let proposal = await selectedAsset.getProposal(id).toPromise();
        proposal.idx = i;
        proposals.push(proposal);
    }
    return proposals;
}