import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, {events} from '@aragon/api'

const app = new Aragon()

app.store(
async (state, {event}) => {
        const nextState = {
            ...state,
        }
        try {
            switch (event) {
                case 'PAYMENT_RECEIVED':
                    return {
                        ...nextState,
                        treasuryBalance: await getTreasuryBalance(),
                        funds: await getFunds()
                    }
                case 'TRESURY_DEPOSIT':
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
                case 'COMPLETED_OFFER':
                case 'CANCELLED_OFFER':
                    return {
                        ...nextState,
                        owners: await getOwners(),
                        offers: await getActiveOffers(),
                        proposals: await getActiveProposals()
                    }
                case 'NEW_PEOPOSAL':
                case 'CANCELLED_PROPOSAL':
                case 'SUPPORT_TRANSFERRED':
                    return {
                        ...nextState,
                        supportedProposal: await getSupportedProposal(),
                        proposals: await getActiveProposals()
                    }
                case 'EXECUTED_PROPOSAL':
                    return {
                        ...nextState,
                        assetDescription: await getAssetDescription(),
                        treasuryRatio: await getTreasuryRatio(),
                        payoutPeriod: await getPayoutPeriod(),
                        proposalApprovalThreshold: await getProposalApprovalThreshold(),
                        treasuryBalance: await getTreasuryBalance(),
                        supportedProposal: await getSupportedProposal(),
                        proposals: await getActiveProposals()
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
            TOTAL_SHARES: await getTotalShares(),
            TREASURY_RATIO_DENOMINATOR: await getTreasuryRatioDenominator(),
            functionIds: await getTaskFunctionValues(),
            assetDescription: await getAssetDescription(),
            treasuryRatio: await getTreasuryRatio(),
            payoutPeriod: await getPayoutPeriod(),
            proposalApprovalThreshold: await getProposalApprovalThreshold(),
            treasuryBalance: await getTreasuryBalance(),
            funds: await getFunds(),
            supportedProposal: await getSupportedProposal(),
            owners: await getOwners(),
            offers: await getActiveOffers(),
            proposals: await getActiveProposals()
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
    let temp = await app.call('getTaskFunctionValues').toPromise();
    console.log(temp);
    return temp;
}

async function getAssetDescription() {
    return await app.call('getAssetDescription').toPromise();
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

async function getTreasuryBalance() {
    return parseInt(await app.call('getTreasuryBalance').toPromise(), 10);
}

async function getFunds() {
    return parseInt(await app.call('getFunds').toPromise(), 10);
}

async function getSupportedProposal() {
    let temp = parseInt(await app.call('getSupportedProposal').toPromise(), 10);
    console.log('Supported proposal: ' + temp);
    return temp;
}

async function getOwners() {
    let ownersCount = parseInt(await app.call('getOwnersCount').toPromise(), 10);
    let owners = [];
    for (let i = 0; i != ownersCount; ++i) {
        let address = await app.call('getOwnerAddressByIndex', i).toPromise();
        owners.push({
            'address': address,
            'shares': parseInt(await app.call('getShares', address).toPromise(), 10),
            'sharesOnSale': parseInt(await app.call('getSharesOnSale', address).toPromise(), 10)
        });
    }
    return owners;
}

async function getActiveOffers() {
    let offersCount = parseInt(await app.call('getActiveOffersCount').toPromise(), 10);
    let offers = [];
    for (let i = 0; i != offersCount; ++i) {
        offers.push(await app.call('getActiveOfferByIndex', i).toPromise());
    }
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