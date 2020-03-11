import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, {events} from '@aragon/api'

const app = new Aragon()
var offerList = [];

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
                case 'SELL_OFFER':
                    return {
                        ...nextState,
                        length: await getLength(),
                        offer: await getOffer(),
                        offerList: await getList()
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
            treasuryBalance: 0,
            funds: 0
        }
    }
}

async function getTreasuryBalance() {
    return parseInt(await app.call('getTreasuryBalance').toPromise(), 10);
}

async function getFunds() {
    return parseInt(await app.call('getFunds').toPromise(), 10);
}

async function getOffer() {
    const value = await app.call('getSellOffer').toPromise();
    offerList.push(value)
    return value;
}

async function getLength() {
    return parseInt(await app.call('getShares').toPromise(), 10);
}

async function getList() {
    return offerList;
}