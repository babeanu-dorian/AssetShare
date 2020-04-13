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
                        pendingPayout: await getPendingPayout(state.currentUser),
                        sharesHistory: await getSharesHistory(state.currentUser),
                        sharesInvestment: await getSharesInvestment(state.currentUser),
                        sharesSoldGains: await getSharesSoldGains(state.currentUser),
                        assetDescription: await getAssetDescription(),
                        treasuryRatio: await getTreasuryRatio(),
                        proposalApprovalThreshold: await getProposalApprovalThreshold(),
                        treasuryBalance: await getTreasuryBalance(),
                        paymentHistory: await getPaymentHistory(),
                        shareValueHistory: await getShareValueHistory(),
                        owners: await getOwners(),
                        offers: await getActiveOffers(),
                        proposals: await getActiveProposals(),
                        supportedProposals: await getSupportedProposals(state.currentUser)
                    }
                case 'PAYMENT_RECEIVED':
                    return {
                        ...nextState,
                        pendingPayout: await getPendingPayout(state.currentUser),
                        treasuryBalance: await getTreasuryBalance(),
                        paymentHistory: await getPaymentHistory()
                    }
                case 'TREASURY_DEPOSIT':
                    return {
                        ...nextState,
                        treasuryBalance: await getTreasuryBalance()
                    }
                case 'PAYOUT_WITHDRAWN':
                    return {
                        ...nextState,
                        pendingPayout: 0
                    }
                case 'NEW_OFFER':
                case 'CANCELLED_OFFER':
                    return {
                        ...nextState,
                        owners: await getOwners(),
                        offers: await getActiveOffers()
                    }
                case 'SHARES_TRANSFERRED':
                    return {
                        ...nextState,
                        owners: await getOwners(),
                        offers: await getActiveOffers(),
                        sharesHistory: await getSharesHistory(state.currentUser),
                        sharesInvestment: await getSharesInvestment(state.currentUser),
                        sharesSoldGains: await getSharesSoldGains(state.currentUser),
                        shareValueHistory: await getShareValueHistory()
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
                        pendingPayout: await getPendingPayout(event.returnValues.account),
                        supportedProposals: await getSupportedProposals(event.returnValues.account),
                        sharesHistory: await getSharesHistory(event.returnValues.account),
                        sharesInvestment: await getSharesInvestment(event.returnValues.account),
                        sharesSoldGains: await getSharesSoldGains(event.returnValues.account)
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
            pendingPayout: 0,
            sharesHistory: [],
            sharesInvestment: 0,
            sharesSoldGains: 0,
            assetDescription: '',
            treasuryRatio: 0,
            proposalApprovalThreshold: 0,
            treasuryBalance: 0,
            paymentHistory: [],
            shareValueHistory: [],
            owners: {},
            offers: {
                sellOffers: [],
                buyOffers: []
            },
            proposals: [],
            supportedProposals: {}
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

async function getProposalApprovalThreshold() {
    return await selectedAsset.getProposalApprovalThreshold().toPromise();
}

async function getTreasuryBalance() {
    return parseInt(await selectedAsset.getTreasuryBalance().toPromise(), 10);
}

async function getOwners() {
    let ownersCount = parseInt(await selectedAsset.getOwnersCount().toPromise(), 10);
    let owners = {};
    for (let i = 0; i != ownersCount; ++i) {
        let address = await selectedAsset.getOwnerAddressByIndex(i).toPromise();
        owners[address] = {
            'address': address,
            'shares': parseInt(await selectedAsset.getSharesByAddress(address).toPromise(), 10),
            'sharesOnSale': parseInt(await selectedAsset.getSharesOnSaleByAddress(address).toPromise(), 10)
        };
    }
    return owners;
}

async function getPendingPayout(address) {
    if (!address || !selectedAsset) return 0;
    return parseInt(await selectedAsset.getPendingPayout(address).toPromise(), 10);
}

async function getSharesInvestment(address) {
    if (!address || !selectedAsset) return 0;
    return parseInt(await selectedAsset.getSharesInvestmentByAddress(address).toPromise(), 10);
}

async function getSharesSoldGains(address) {
    if (!address || !selectedAsset) return 0;
    return parseInt(await selectedAsset.getSharesSoldGainsByAddress(address).toPromise(), 10);
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

async function getSupportedProposals(address) {

    if (!address || !selectedAsset) return [];

    let count = parseInt(await selectedAsset.getSupportedProposalsCount(address).toPromise(), 10);
    let proposals = {};
    for (let i = 0; i != count; ++i) {
        let id = parseInt(await selectedAsset.getSupportedProposalIdByIndex(address, i).toPromise(), 10);
        let proposal = await selectedAsset.getProposal(id).toPromise();
        proposal.idx = i;
        proposals[id] = proposal;
    }
    return proposals;
}

async function getSharesHistory(address) {

    if (!address || !selectedAsset) return [];

    let count = parseInt(await selectedAsset.getSharesHistoryLength(address).toPromise(), 10);
    let history = [];
    for (let i = 0 ; i < count ; ++i) {
        history.push(await selectedAsset.getSharesHistoryByIdx(address, i).toPromise());
    }
    history.push({
        amount: parseInt(await selectedAsset.getSharesByAddress(address).toPromise(), 10),
        timestamp: Math.floor(new Date().getTime() / 1000)
    });
    return history;
}

async function getPaymentHistory() {
    let count = parseInt(await selectedAsset.getPaymentHistoryLength().toPromise(), 10);
    let history = [];
    for (let i = 0 ; i < count ; ++i) {
        history.push(await selectedAsset.getPaymentHistoryByIdx(i).toPromise());
    }
    return history;
}

async function getShareValueHistory() {
    let count = parseInt(await selectedAsset.getShareValueHistoryLength().toPromise(), 10);
    let history = [];
    for (let i = 0 ; i < count ; ++i ) {
        history.push(await selectedAsset.getShareValueHistoryByIdx(i).toPromise());
    }
    return history;
}