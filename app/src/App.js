import React, {useState} from 'react'
import {useAragonApi} from '@aragon/api-react'
import {
    AddressField,
    Box,
    Button,
    DataView,
    GU,
    Header,
    IconMinus,
    IconPlus,
    IdentityBadge,
    Main,
    SyncIndicator,
    Tabs,
    Text,
    TextInput,
    textStyle,
    ContextMenu,
    ContextMenuItem, DropDown

} from '@aragon/ui'
import styled from 'styled-components'

function App() {
    const {api, appState, path} = useAragonApi();
    const {TOTAL_SHARES, treasuryBalance, funds, owners, offers, isSyncing} = appState;
    const [selectedTab, setSelectedTab] = useState(0);
    const [amount, setAmount] = useState(0);
    const [message, setMessage] = useState('');
    const [shares, setShares] = useState(0);
    const [price, setPrice] = useState(0);
    const [intendedBuyer, setIntendedBuyer] = useState('');
    const anyAddress = '0x0000000000000000000000000000000000000000';

    function sharesToPercentage(shares) {
        return shares * 100 / TOTAL_SHARES;
    }

    function percentageToShares(percentage) {
        return percentage * TOTAL_SHARES / 100;
    }

    function displayAddress(address) {
        return (address == anyAddress ? '-' : <IdentityBadge entity={address}/>);
    }

    let selectedView;


    function onlySpecificOffers(sellOrBuy) {
        var temp = [];
        if (sellOrBuy === "SELL"){
            for (let i = 0; i <offers.length; i++) {
                if(offers[i].offerType === "SELL"){
                    temp.push(offers[i])
                }
            }
            return temp
        }
        if (sellOrBuy === "BUY"){
            for (let i = 0; i <offers.length; i++) {
                if(offers[i].offerType === "BUY"){
                    temp.push(offers[i])
                }
            }
            return temp
        }

    }

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
                            onClick={() => api.offerToSell(percentageToShares(shares), price, (intendedBuyer ? intendedBuyer : anyAddress)).toPromise()}
                        />
                    </Buttons>
                    <DataView
                        display="table"
                        fields={['Id', 'Seller', 'Intended Buyer', 'Shares (%)', 'Price (wei)', 'Buy', 'Cancel']}
                        entries={onlySpecificOffers("SELL")}
                        renderEntry={({id, seller, buyer, shares, price}) => {
                            return [id,
                                displayAddress(seller),
                                displayAddress(buyer),
                                sharesToPercentage(shares),
                                price,
                                <Button
                                    display="label"
                                    label="Buy"
                                    onClick={() => api.buyShares(id, {'value': price}).toPromise()}
                                />,
                                <Button
                                    display="label"
                                    label="Cancel"
                                    onClick={() => api.cancelOffer(id).toPromise()}
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
                            onClick={() => api.offerToBuy(percentageToShares(shares), price, (intendedBuyer ? intendedBuyer : anyAddress)).toPromise()}
                        />
                        <Button
                            display="console log"
                            label="Cancel"
                            onClick={console.log(offers)}
                        />
                    </Buttons>
                    <DataView
                        display="table"
                        fields={['Id', 'Buyer', 'Intended Seller', 'Shares (%)', 'Price (wei)', 'Sell', 'Cancel']}
                        entries={onlySpecificOffers("BUY")}
                        renderEntry={({id, seller, buyer, shares, price}) => {
                            console.log(percentageToShares(shares))
                            return [id,
                                displayAddress(seller),
                                displayAddress(buyer),
                                sharesToPercentage(shares),
                                price,
                                <Button
                                    display="label"
                                    label="Sell"
                                    onClick={() => api.offerToSell(shares, price, seller).toPromise()}
                                />,
                                <Button
                                    display="label"
                                    label="Cancel"
                                    onClick={() => api.cancelOffer(id).toPromise()}
                                />
                            ]
                        }}
                    />
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
                items={['Payments', 'Owners', 'Sell Offers', 'Buy Offers']}
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
