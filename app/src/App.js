import React, {useState} from 'react'
import {useAragonApi} from '@aragon/api-react'
import {
    Box,
    Button,
    DataView,
    Header,
    IdentityBadge,
    Main,
    SyncIndicator,
    Tabs,
    TextInput,
    textStyle,
} from '@aragon/ui'
import styled from 'styled-components'

function App() {
    const {api, appState, path} = useAragonApi();
    const {TOTAL_SHARES, treasuryBalance, funds, owners, sell_offers, buy_offers, isSyncing} = appState;
    const [selectedTab, setSelectedTab] = useState(0);
    const [amount, setAmount] = useState(0);
    const [message, setMessage] = useState('');
    const [shares, setShares] = useState(0);
    const [price, setPrice] = useState(0);
    const [partialShares, setPartialShares] = useState(0);
    const [newPrice, setNewPrice] = useState(0);
    const [intendedBuyer, setIntendedBuyer] = useState('');
    const anyAddress = '0x0000000000000000000000000000000000000000';

    const [opened, setOpened] = useState(false);

    function sharesToPercentage(shares) {
        return shares * 100 / TOTAL_SHARES;
    }

    function percentageToShares(percentage) {
        return percentage * TOTAL_SHARES / 100;
    }

    function displayAddress(address) {
        return (address == anyAddress ? '-' : <IdentityBadge entity={address}/>);
    }

    function calculatePartialPrice(price, shares) {
        return shares * price;

    }

    let selectedView;


    switch (selectedTab) {
        case 0: //Payments
            selectedView = (
                <Box>
                    TreasuryBalance: {treasuryBalance} <br/>
                    Funds: {funds} <br/>

                    Amount (wei): <TextInput.Number
                    value={amount}
                    onChange={event => setAmount(parseInt(event.target.value), 10)}
                /> <br/>
                    Message: <TextInput
                    value={message}
                    onChange={event => setMessage(event.target.value)}
                /> <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Make payment"
                            onClick={() => api.payment(message, {'value': amount}).toPromise()}
                        />
                        <Button
                            display="label"
                            label="Deposit to treasury"
                            onClick={() => api.treasuryDeposit(message, {'value': amount}).toPromise()}
                        />
                        <Button
                            display="label"
                            label="Distribute revenue"
                            onClick={() => api.payOwners().toPromise()}
                        />
                    </Buttons>
                </Box>
            );
            break;
        case 1: //Owners
            selectedView = (
                <Box>
                    <DataView
                        display="table"
                        fields={['Address', 'Shares (%)', 'Shares on Sale (%)']}
                        entries={owners}
                        renderEntry={({address, shares, sharesOnSale}) => {
                            return [displayAddress(address), sharesToPercentage(shares), sharesToPercentage(sharesOnSale)]
                        }}
                    />
                </Box>
            );
            break;
        case 2: //Offers
            selectedView = (
                <Box>
                    <div
                        css={`
        ${textStyle('body1')};
      `}
                    >
                        Sell Offers
                    </div>

                    Shares to sell
                    (%): <TextInput.Number
                    value={shares}
                    onChange={event => setShares(parseInt(event.target.value), 10)}
                /> <br/>
                    Price (wei): <TextInput.Number
                    value={price}
                    onChange={event => setPrice(parseInt(event.target.value), 10)}
                /> <br/>
                    Intended buyer: <TextInput
                    value={intendedBuyer}
                    onChange={event => setIntendedBuyer(event.target.value)}
                /> <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Publish Offer"
                            onClick={() => api.offerToSell(percentageToShares(shares), price).toPromise()}
                        />
                    </Buttons>
                    <DataView
                        display="table"
                        fields={['Id', 'Seller', 'Remaining Shares (%)','Shares (%)', 'Price (wei)', 'Partial', 'Buy', 'Cancel']}
                        entries={sell_offers}
                        renderEntry={({id, creator, sharesRemaining, shares, price}) => {
                            return [id,
                                displayAddress(creator),
                                (sharesToPercentage(sharesRemaining)/sharesToPercentage(shares) * 100),
                                sharesToPercentage(sharesRemaining),
                                calculatePartialPrice(price, sharesRemaining),
                                <TextInput.Number
                                    value={partialShares}
                                    onChange={event => {
                                        setPartialShares(parseInt(event.target.value), 10)
                                    }}
                                />,
                                <Button
                                    display="label"
                                    label="Buy"
                                    onClick={() => {
                                        api.offerToBuy(percentageToShares(partialShares),price, {'value': calculatePartialPrice(percentageToShares(price),partialShares)}).toPromise()
                                    }
                                    }
                                />,
                                <Button
                                    display="label"
                                    label="Cancel"
                                    onClick={() => api.collectOffer(id).toPromise()}
                                />

                            ]
                        }}
                    />

                    <div
                        css={`
        ${textStyle('body1')};
      `}
                    >
                        Buy Offers
                    </div>


                    Shares to buy (%): <TextInput.Number
                    value={shares}
                    onChange={event => setShares(parseInt(event.target.value), 10)}
                /> <br/>
                    Price (wei): <TextInput.Number
                    value={price}
                    onChange={event => setPrice(parseInt(event.target.value), 10)}
                /> <br/>
                    Intended buyer: <TextInput
                    value={intendedBuyer}
                    onChange={event => setIntendedBuyer(event.target.value)}
                /> <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Publish Offer"
                            onClick={() => {
                                api.offerToBuy(percentageToShares(shares), price, {'value': calculatePartialPrice(percentageToShares(price), shares)}).toPromise()
                                console.log(price)
                            }
                            }
                        />
                        <Button
                            display="label"
                            label="Test"
                            onClick={() =>
                                console.log((sell_offers))}
                        />
                    </Buttons>
                    <DataView
                        display="table"
                        fields={['Id', 'Buyer', 'Remaining shares (%)','Shares (%)', 'Price (wei)', 'Partial shares', 'Sell', 'Cancel']}
                        entries={buy_offers}
                        renderEntry={({id, creator, sharesRemaining, shares, price}) => {
                            return [id,
                                displayAddress(creator),
                                (sharesToPercentage(sharesRemaining)/sharesToPercentage(shares) * 100),
                                sharesToPercentage(sharesRemaining),
                                calculatePartialPrice(price, sharesRemaining),
                                <TextInput.Number
                                    value={partialShares}
                                    onChange={event => {
                                        setPartialShares(parseInt(event.target.value), 10)
                                    }}
                                />,
                                <Button
                                    display="label"
                                    label="Sell"
                                    onClick={() => api.offerToSell(percentageToShares(partialShares), calculatePartialPrice(price, partialShares)).toPromise()}
                                />,
                                <Button
                                    display="label"
                                    label="Cancel"
                                    onClick={() => api.collectOffer(id).toPromise()}
                                />
                            ]
                        }}
                    />
                </Box>

            )
            break;
        case 3: //Buy Offers
            selectedView = (
                <Box>
                </Box>
            )
    }

    return (
        <Main>
            {isSyncing && <SyncIndicator/>}
            <Header
                primary="AssetShare"
            />
            <Tabs
                items={['Payments', 'Owners', 'Offers', 'Proposals']}
                selected={selectedTab}
                onChange={setSelectedTab}
            />
            {selectedView}
        </Main>
    )
}


const Buttons = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-gap: 40px;
  margin-top: 20px;
`

export default App
