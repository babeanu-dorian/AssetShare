import React from 'react'
import ReactDOM from 'react-dom'
import {AragonApi} from '@aragon/api-react'
import App from './App'

const reducer = state => {
    if (state === null) {
        return {
            TOTAL_SHARES: 0,
            treasuryBalance: 0,
            funds: 0,
            owners: [],
            sell_offers: [],
            buy_offers: [],
            isSyncing: true,
            flag: 0
        }
    }
    return state
}

ReactDOM.render(
    <AragonApi reducer={reducer}>
        <App/>
    </AragonApi>,
    document.getElementById('root')
)
