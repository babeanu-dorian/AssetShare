import 'core-js/stable'
import 'regenerator-runtime/runtime'
import Aragon, {events} from '@aragon/api'

const app = new Aragon()

// var offerList = [];
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
                        offerList: await getSellOfferList(),
                        sharesAmount: await getAmountOfShares()
                    }
                case 'BUY_OFFER':
                    return {
                        ...nextState,
                        offerList: await getSellOfferList()
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
            funds: 0,
            sharesAmount:0,
            length:0
        }
    }
}

async function getTreasuryBalance() {
    return parseInt(await app.call('getTreasuryBalance').toPromise(), 10);
}

async function getFunds() {
    return parseInt(await app.call('getFunds').toPromise(), 10);
}



async function getSellOfferList(){
    // var length =  await( app.call('getLengthOfList').toPromise());
    var length =  await( app.call('getLengthOfActiveList').toPromise());


    var offerList = [];
    for (let i = 0; i < length; i++) {
        var offer = await app.call('activeOffersList',i).toPromise()
        offerList.push(offer)
    }
    return offerList
}


async function getAmountOfShares() {
    return parseInt(await app.call('getAmountOfShares').toPromise(), 10);

}
