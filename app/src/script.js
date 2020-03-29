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
                    await getBuyActiveOffers();
                    await getSellActiveOffers();
                    return {
                        ...nextState,
                        owners: await getOwners(),
                        sell_offers: await getSellActiveOffers(),
                        buy_offers: await getBuyActiveOffers()
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
            treasuryBalance: await getTreasuryBalance(),
            funds: await getFunds(),
            owners: await getOwners(),
            sell_offers: await getSellActiveOffers(),
            buy_offers: await getBuyActiveOffers(),
        }
    }
}


async function getTotalShares() {
    return parseInt(await app.call('TOTAL_SHARES').toPromise(), 10);
}

async function getTreasuryBalance() {
    return parseInt(await app.call('getTreasuryBalance').toPromise(), 10);
}

async function getFunds() {
    return parseInt(await app.call('getFunds').toPromise(), 10);
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


async function getSellActiveOffers() {
    let offersCount = parseInt(await app.call('getActiveSellOffersCount').toPromise(), 10);
    let sell_offers = [];
    for (let i = 0; i != offersCount; ++i) {
        sell_offers.push(await app.call('getActiveSellOfferByIndex', i).toPromise());
    }
    return sell_offers;
}

async function getBuyActiveOffers() {
    let offersCount = parseInt(await app.call('getActiveBuyOffersCount').toPromise(), 10);
    let buy_offers = [];
    for (let i = 0; i != offersCount; ++i) {
        buy_offers.push(await app.call('getActiveBuyOfferByIndex', i).toPromise());
    }
    return buy_offers;
}