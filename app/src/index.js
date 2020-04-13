import React from 'react'
import ReactDOM from 'react-dom'
import {AragonApi} from '@aragon/api-react'
import App from './App'

const reducer = state => {

    if (state === null) {
        return {
            sharedAssets: [],
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
            supportedProposals: {},
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
