import React, {useState} from 'react'
import {useAragonApi} from '@aragon/api-react'
import {
    Box,
    Button,
    Checkbox,
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
    const {api, appState, path, connectedAccount} = useAragonApi();
    const {TOTAL_SHARES, treasuryBalance, funds, owners, offers, isSyncing} = appState;
    const [selectedTab, setSelectedTab] = useState(0);
    const [amount, setAmount] = useState(0);
    const [message, setMessage] = useState('');
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [intendedParty, setIntendedParty] = useState('');
    const [autocompleteCheck, setAutocompleteCheck] = useState(true);
    const [selectedOfferTab, setSelectedOfferTab] = useState(0);
    const [partialShares, setPartialShares] = useState({});

    const anyAddress = '0x0000000000000000000000000000000000000000';
    const weiInEth = 1000000000000000000.0;

    function weiToEth(amount) {
        return amount / weiInEth;
    }

    function ethToWei(amount) {
        return amount * weiInEth;
    }

    function sharesToPercentage(shares) {
        return shares * 100 / TOTAL_SHARES;
    }

    function percentageToShares(percentage) {
        return percentage * TOTAL_SHARES / 100;
    }

    function ethPerPercentageToWeiPerShare(amount) {
        return ethToWei(amount) * 100 / TOTAL_SHARES;
    }

    function calcPartialPrice(percentageShares, pricePerShare) {
        return pricePerShare * percentageToShares(percentageShares);
    }

    function displayAddress(address) {
        return (address == anyAddress ? '-' : <IdentityBadge entity={address}/>);
    }

    function sellShares(sellOffer, autocompleteOn, buyIdx = 0) {

        if (autocompleteOn && buyIdx != offers.buyOffers.length) {
            const buyOffer = offers.buyOffers[buyIdx];

            // if there are no compatible buying offers, skip to the end (list is sorted by price)
            if (parseInt(buyOffer.price) < parseInt(sellOffer.price))
                return sellShares(sellOffer, autocompleteOn, offers.buyOffers.length);

            // prevent user from trading with him/herself
            if (sellOffer.seller == buyOffer.buyer)
                return sellShares(sellOffer, autocompleteOn, buyIdx + 1);

            // skip offers where buyer is not the intended buyer
            if (sellOffer.buyer != anyAddress && sellOffer.buyer != buyOffer.buyer)
                return sellShares(sellOffer, autocompleteOn, buyIdx + 1);

             // skip offers where seller is not the intended seller
            if (buyOffer.seller != anyAddress && buyOffer.seller != sellOffer.seller)
                return sellShares(sellOffer, autocompleteOn, buyIdx + 1);

            if (sellOffer.id == null) { // no existing sell offer, just complete buy offers
                const sharesToSell = (parseInt(sellOffer.shares) >= parseInt(buyOffer.shares) ? buyOffer.shares : sellOffer.shares);
                api.sellShares(buyOffer.id, sharesToSell).subscribe(
                    txHash => {
                        sellOffer.shares -= sharesToSell;
                        sellShares(sellOffer, autocompleteOn, buyIdx + 1);
                    },
                    err => console.log(err)
                );
            } else { // existing sell offer, combine offers
                api.combineOffers(sellOffer.id, buyOffer.id).subscribe(
                    txHash => {
                        sellOffer.shares -= (parseInt(sellOffer.shares) >= parseInt(buyOffer.shares) ? buyOffer.shares : sellOffer.shares);
                        sellShares(sellOffer, autocompleteOn, buyIdx + 1);
                    },
                    err => console.log(err)
                );
            }
        } else {
            if (sellOffer.id == null && sellOffer.shares != 0) {
                // some shares remained unsold, publish sell offer
                api.offerToSell(sellOffer.shares, sellOffer.price, sellOffer.buyer).toPromise();
            }
        }
    }

    function buyShares(buyOffer, autocompleteOn, sellIdx = 0) {

        if (autocompleteOn && sellIdx != offers.sellOffers.length) {
            const sellOffer = offers.sellOffers[sellIdx];

            // if there are no compatible selling offers, skip to the end (list is sorted by price)
            if (parseInt(buyOffer.price) < parseInt(sellOffer.price))
                return buyShares(buyOffer, autocompleteOn, offers.sellOffers.length);

            // prevent user from trading with him/herself
            if (buyOffer.buyer == sellOffer.seller)
                return buyShares(buyOffer, autocompleteOn, sellIdx + 1);

             // skip offers where seller is not the intended seller
            if (buyOffer.seller != anyAddress && buyOffer.seller != sellOffer.seller)
                return buyShares(buyOffer, autocompleteOn, sellIdx + 1);

            // skip offers where buyer is not the intended buyer
            if (sellOffer.buyer != anyAddress && sellOffer.buyer != buyOffer.buyer)
                return buyShares(buyOffer, autocompleteOn, sellIdx + 1);

            if (buyOffer.id == null) { // no existing buy offer, just complete sell offers
                const sharesToBuy = (parseInt(buyOffer.shares) >= parseInt(sellOffer.shares) ? sellOffer.shares : buyOffer.shares);
                api.buyShares(sellOffer.id, sharesToBuy, {'value': sharesToBuy * sellOffer.price}).subscribe(
                    txHash => {
                        buyOffer.shares -= sharesToBuy;
                        buyShares(buyOffer, autocompleteOn, sellIdx + 1);
                    },
                    err => console.log(err)
                );
            } else { // existing buy offer, combine offers
                api.combineOffers(sellOffer.id, buyOffer.id).subscribe(
                    txHash => {
                        buyOffer.shares -= (parseInt(buyOffer.shares) >= parseInt(sellOffer.shares) ? sellOffer.shares : buyOffer.shares);
                        buyShares(buyOffer, autocompleteOn, sellIdx + 1);
                    },
                    err => console.log(err)
                );
            }
        } else {
            if (buyOffer.id == null && buyOffer.shares != 0) {
                // some shares remained unsold, publish sell offer
                api.offerToBuy(buyOffer.shares, buyOffer.price, buyOffer.seller, {'value': buyOffer.shares * buyOffer.price}).toPromise();
            }
        }
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

            let activeOffersView;

            switch (selectedOfferTab) {
                case 0: // sell offers
                    activeOffersView = (
                        <DataView
                            display="table"
                            fields={['Id', 'Seller', 'Intended Buyer','Shares (%)', 'Price (eth)', 'Shares to buy (%)', 'Buy', 'Autocomplete', 'Cancel']}
                            entries={offers.sellOffers}
                            renderEntry={({id, seller, buyer, shares, price}) => {

                                if (partialShares[id] == null)
                                    partialShares[id] = 1;

                                return [
                                    id,
                                    displayAddress(seller),
                                    displayAddress(buyer),
                                    sharesToPercentage(shares),
                                    weiToEth(calcPartialPrice(partialShares[id], price)),
                                    <TextInput.Number
                                        value={partialShares[id]}
                                        onChange={event => setPartialShares({...partialShares, [id] : parseFloat(event.target.value)})}
                                    />,
                                    <Button
                                        display="label"
                                        label="Buy"
                                        onClick={() => api.buyShares(id, percentageToShares(partialShares[id]), {'value': calcPartialPrice(partialShares[id], price)}).toPromise()}
                                    />,
                                    <Button
                                        display="label"
                                        label="Autocomplete"
                                        onClick={() => {
                                            if (connectedAccount != seller) {
                                                console.log('Error: Only the offer owner can autocomplete it.');
                                                return;
                                            }
                                            sellShares({id, seller, buyer, price, shares}, true);
                                        }}
                                    />,
                                    <Button
                                        display="label"
                                        label="Cancel"
                                        onClick={() => api.cancelOffer(id).toPromise()}
                                    />
                                ]
                            }}
                        />
                    );
                    break;
                case 1: // buy offers
                    activeOffersView = (
                        <DataView
                            display="table"
                            fields={['Id', 'Buyer', 'Intended Seller','Shares (%)', 'Offer (eth)', 'Shares to sell (%)', 'Sell', 'Autocomplete', 'Cancel']}
                            entries={offers.buyOffers}
                            renderEntry={({id, seller, buyer, shares, price}) => {

                                if (partialShares[id] == null)
                                    partialShares[id] = 1;

                                return [
                                    id,
                                    displayAddress(buyer),
                                    displayAddress(seller),
                                    sharesToPercentage(shares),
                                    weiToEth(calcPartialPrice(partialShares[id], price)),
                                    <TextInput.Number
                                        value={partialShares[id]}
                                        onChange={event => setPartialShares({...partialShares, [id] : parseFloat(event.target.value)})}
                                    />,
                                    <Button
                                        display="label"
                                        label="Sell"
                                        onClick={() => api.sellShares(id, percentageToShares(partialShares[id])).toPromise()}
                                    />,
                                    <Button
                                        display="label"
                                        label="Autocomplete"
                                        onClick={() => {
                                            if (connectedAccount != buyer) {
                                                console.log('Error: Only the offer owner can autocomplete it.');
                                                return;
                                            }
                                            buyShares({id, seller, buyer, price, shares}, true);
                                        }}
                                    />,
                                    <Button
                                        display="label"
                                        label="Cancel"
                                        onClick={() => api.cancelOffer(id).toPromise()}
                                    />
                                ]
                            }}
                        />
                    );
            }

            selectedView = (
                <Box>
                    Shares (%): <TextInput.Number
                        value={shares}
                        onChange={event => setShares(event.target.value)}
                    /> <br/>
                    Price (eth / %): <TextInput.Number
                        value={price}
                        onChange={event => setPrice(event.target.value)}
                    /> <br/>
                    Intended buyer / seller: <TextInput
                        value={intendedParty}
                        onChange={event => setIntendedParty(event.target.value)}
                    /> <br/>
                    <Checkbox
                        checked={autocompleteCheck}
                        onChange={setAutocompleteCheck}
                    /> Autocomplete <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Offer to sell"
                            onClick={() => sellShares({
                                    id: null,
                                    seller: connectedAccount,
                                    buyer: (intendedParty ? intendedParty : anyAddress),
                                    shares: percentageToShares(parseFloat(shares)),
                                    price: ethPerPercentageToWeiPerShare(price)
                                }, autocompleteCheck)
                            }
                        />
                        <Button
                            display="label"
                            label="Offer to buy"
                            onClick={() => buyShares({
                                    id: null,
                                    seller: (intendedParty ? intendedParty : anyAddress),
                                    buyer: connectedAccount,
                                    shares: percentageToShares(parseFloat(shares)),
                                    price: ethPerPercentageToWeiPerShare(price)
                                }, autocompleteCheck)
                            }
                        />
                    </Buttons>
                    <Tabs
                        items={['Sell-Offers', 'Buy-Offers']}
                        selected={selectedOfferTab}
                        onChange={setSelectedOfferTab}
                    />
                    {activeOffersView}
                </Box>
            )
            break;
        case 3: //Proposals
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
