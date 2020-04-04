import React from 'react'
import ReactDOM from 'react-dom'
import {AragonApi} from '@aragon/api-react'
import App from './App'

const reducer = state => {

    if (state === null) {
        return {
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
            supportedProposals: [],
            isSyncing: true
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
