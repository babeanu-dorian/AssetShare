import React, {useState} from 'react'
import {useAragonApi} from '@aragon/api-react'
import {
    Box,
    Button,
    Checkbox,
    DataView,
    DropDown,
    GU,
    Header,
    IdentityBadge,
    Main,
    SyncIndicator,
    Tabs, Text,
    TextInput,
    textStyle
} from '@aragon/ui'

import styled from 'styled-components'
import assetJsonInterface from './SharedAssetInterface'

function App() {
    const {api, appState} = useAragonApi();
    const {
        sharedAssets,
        TOTAL_SHARES,
        TREASURY_RATIO_DENOMINATOR,
        functionIds,
        currentUser,
        assetDescription,
        treasuryRatio,
        payoutPeriod,
        proposalApprovalThreshold,
        treasuryBalance,
        funds,
        owners,
        offers,
        proposals,
        supportedProposals,
        isSyncing
    } = appState;
    const [selectedTab, setSelectedTab] = useState(0);
    const [description, setDescription] = useState('');
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [assetEventSubscription, setAssetEventSubscription] = useState(null);
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [selectedOfferTab, setSelectedOfferTab] = useState(0);
    const [partialShares, setPartialShares] = useState({});
    const [intendedParty, setIntendedParty] = useState('');
    const [autocompleteCheck, setAutocompleteCheck] = useState(true);
    const [selectedProposalFunction, setSelectedProposalFunction] = useState(0);
    const [newApprovalThreshold, setNewApprovalThreshold] = useState('');
    const [newAssetDescription, setNewAssetDescription] = useState('');
    const [newPayoutPeriod, setNewPayoutPeriod] = useState('');
    const [newTreasuryRatio, setNewTreasuryRatio] = useState('');
    const [contractAddress, setContractAddress] = useState('');
    const [functionSignature, setFunctionSignature] = useState('');
    const [amountToSendInCall, setAmountToSendInCall] = useState('');
    const [addressToSend, setAddressToSend] = useState('');
    const [amountToSend, setAmountToSend] = useState('');
    const [proposalText, setProposalText] = useState('');
    const [proposalReason, setProposalReason] = useState('');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('.')[0]);
    const anyAddress = '0x0000000000000000000000000000000000000000';
    const weiInEth = 1000000000000000000.0;

    function weiToEth(amount) {
        return amount / weiInEth;
    }


    function searchOwners(currentUser) {
        for (var i = 0; i < owners.length; i++) {
            if (owners[i].address === currentUser) {
                console.log(currentUser);
                return owners[i].shares
            }
        }
    }

    function ethToWei(amount) {
        return amount * weiInEth;
    }

    function percentageToAmount(percentage, total) {
        return percentage * total / 100;
    }

    function amountToPercentage(amount, total) {
        return amount * 100 / total;
    }

    function ethPerPercentageToWeiPerShare(amount) {
        return ethToWei(amount * 100 / TOTAL_SHARES);
    }

    function calcPartialPrice(percentageShares, pricePerShare) {
        return pricePerShare * percentageToAmount(percentageShares, TOTAL_SHARES);
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
                selectedAsset.sellShares(buyOffer.id, sharesToSell).subscribe(
                    txHash => {
                        sellOffer.shares -= sharesToSell;
                        sellShares(sellOffer, autocompleteOn, buyIdx + 1);
                    },
                    err => console.log(err)
                );
            } else { // existing sell offer, combine offers
                selectedAsset.combineOffers(sellOffer.id, buyOffer.id).subscribe(
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
                selectedAsset.offerToSell(sellOffer.shares, sellOffer.price, sellOffer.buyer).toPromise();
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
                selectedAsset.buyShares(sellOffer.id, sharesToBuy, {'value': sharesToBuy * sellOffer.price}).subscribe(
                    txHash => {
                        buyOffer.shares -= sharesToBuy;
                        buyShares(buyOffer, autocompleteOn, sellIdx + 1);
                    },
                    err => console.log(err)
                );
            } else { // existing buy offer, combine offers
                selectedAsset.combineOffers(sellOffer.id, buyOffer.id).subscribe(
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
                selectedAsset.offerToBuy(buyOffer.shares, buyOffer.price, buyOffer.seller, {'value': buyOffer.shares * buyOffer.price}).toPromise();
            }
        }
    }

    function dateToUnixTimestamp(date) {
        return Math.floor(date.getTime() / 1000);
    }

    function displayDate(unixTime) {
        let date = new Date(unixTime * 1000);
        let year = date.getFullYear();
        let month = toDoubleDigits(1 + date.getMonth());
        let day = toDoubleDigits(date.getDate());
        let hour = toDoubleDigits(date.getHours());
        let minute = toDoubleDigits(date.getMinutes());

        return '' + day + '.' + month + '.' + year + ' ' + hour + ':' + minute;
    }

    function toDoubleDigits(n) {
        if (n > 9) return n;
        return '0' + n;
    }

    function proposalDescription(functionId, uintArg, stringArg, addressArg) {
        switch (functionId) {
            case functionIds.CHANGE_APPROVAL_TRESHOLD:
                return 'Change proposal approval threshold from '
                    + amountToPercentage(proposalApprovalThreshold, TOTAL_SHARES)
                    + '% to '
                    + amountToPercentage(uintArg, TOTAL_SHARES)
                    + '%.';
            case functionIds.CHANGE_ASSET_DESCRIPTION:
                return 'Change asset description to\n\"'
                    + stringArg
                    + '\".';
            case functionIds.CHANGE_PAYOUT_PERIOD:
                return 'Change payout period from '
                    + payoutPeriod
                    + ' seconds to '
                    + uintArg
                    + ' seconds.';
            case functionIds.CHANGE_TREASURY_RATIO:
                return 'Change the percentage of income placed in the treasury from '
                    + amountToPercentage(treasuryRatio, TREASURY_RATIO_DENOMINATOR)
                    + '% to '
                    + amountToPercentage(uintArg, TREASURY_RATIO_DENOMINATOR)
                    + '%.';
            case functionIds.EXECUTE_EXTERNAL_CONTRACT:
                return 'Pay '
                    + weiToEth(uintArg)
                    + ' eth to call function '
                    + stringArg
                    + ' of contract '
                    + addressArg
                    + '.';
            case functionIds.ORIGINAL:
                return stringArg;
            case functionIds.SEND_MONEY:
                return 'Transfer '
                    + weiToEth(uintArg)
                    + ' eth to '
                    + addressArg
                    + '.';
        }
        return '';
    }

    let selectedView;

    switch (selectedTab) {
        case 0: //Asset Registry
            selectedView = (
                <Box css={`width:100%;`}>
                    Asset description: <TextInput
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                /> <br/>
                    <Button
                        display="label"
                        label="Publish"
                        onClick={() => api.createAsset(description).toPromise()}
                    />
                    <DataView
                        display="table"
                        fields={['Address', 'Select']}
                        entries={sharedAssets}
                        renderEntry={(address) => {
                            return [
                                displayAddress(address),
                                <Button
                                    display="label"
                                    label="Select"
                                    onClick={() => {
                                        if (assetEventSubscription != null) {
                                            assetEventSubscription.unsubscribe();
                                        }

                                        const asset = api.external(address, assetJsonInterface);
                                        asset.address = address; // used to display selected asset

                                        api.emitTrigger('ASSET_SELECTED', {address});
                                        setSelectedAsset(asset);
                                        setAssetEventSubscription(asset.events().subscribe(({event, returnValues, address}) => {
                                            api.emitTrigger(event, {...returnValues, contractAddress: address});
                                        }));
                                    }}
                                />
                            ]
                        }}
                    />
                </Box>
            );
            break;
        case 1: //Asset Description
            selectedView = (
                <Box>{assetDescription}</Box>
            );
            break;
        case 2: //Your Profile
            selectedView = (
                <Box>
                    Address:
                    <Text css={`margin-left:90px`}>{displayAddress(currentUser)}</Text> <br/>
                    Shares:
                    <Text css={`margin-left:100px`} >
                        {amountToPercentage(searchOwners(currentUser),TOTAL_SHARES)}
                    </Text>
                    % <br/>
                    Unclaimed Revenue: TODO <br/>
                    Supported Proposals:  <br/>
                    <DataView
                        display="table"
                        fields={['Id', 'Author', 'Description', 'Reason', 'Support (%)', 'End Date', 'Actions']}
                        entries={supportedProposals}
                        renderEntry={({id, idx, owner, reason, completionDate, expirationDate, functionId, uintArg, stringArg, addressArg, support}) => {

                            let active = (completionDate == 0) && (expirationDate > dateToUnixTimestamp(new Date()));

                            return [
                                id,
                                displayAddress(owner),
                                proposalDescription(functionId, uintArg, stringArg, addressArg),
                                reason,
                                amountToPercentage(support, TOTAL_SHARES),
                                displayDate(expirationDate),
                                (active ?
                                    <Buttons>
                                        <Button
                                            display="label"
                                            label="Increase Support"
                                            onClick={() => selectedAsset.supportProposal(id).toPromise()}
                                        />
                                        <Button
                                            display="label"
                                            label="Revoke Support"
                                            onClick={() => selectedAsset.revokeProposalSupport(id).toPromise()}
                                        />
                                        <Button
                                            display="label"
                                            label="Implement"
                                            onClick={() => selectedAsset.executeProposal(id).toPromise()}
                                        />
                                        <Button
                                            display="label"
                                            label="Cancel"
                                            onClick={() => selectedAsset.cancelProposal(id).toPromise()}
                                        />
                                    </Buttons>
                                    :
                                    <Button
                                        display="label"
                                        label="Remove"
                                        onClick={() => selectedAsset.removeInactiveSupportedProposalByIndex(idx).toPromise()}
                                    />
                                )
                            ]
                        }}
                    />
                </Box>
            );
            break;
        case 3: //Payments
            selectedView = (
                <Box>
                    Treasury balance:
                    <Text css={`margin-left:45px;`}>{weiToEth(treasuryBalance)} eth</Text> <br/>
                    Funds:
                    <Text css={`margin-left:124px;`}>{weiToEth(funds)} eth </Text><br/>
                    Amount (eth): <TextInput
                        css={`margin-left:60px;`}
                        type="number"
                        value={amount}
                        onChange={event => setAmount(event.target.value)}
                    /> <br/>
                    Message: <TextInput
                        css={`margin-left:93px;`}
                        value={message}
                        onChange={event => setMessage(event.target.value)}
                    /> <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Make payment"
                            onClick={() => selectedAsset.payment(message, {'value': ethToWei(parseFloat(amount))}).toPromise()}
                        />
                        <Button
                            display="label"
                            label="Deposit to treasury"
                            onClick={() => selectedAsset.treasuryDeposit(message, {'value': ethToWei(parseFloat(amount))}).toPromise()}
                        />
                        <Button
                            display="label"
                            label="Distribute revenue"
                            onClick={() => selectedAsset.payOwners().toPromise()}
                        />
                    </Buttons>
                </Box>
            );
            break;
        case 4: //Owners
            selectedView = (
                <Box>
                    <DataView
                        display="table"
                        fields={['Address', 'Shares (%)', 'Shares on Sale (%)']}
                        entries={owners}
                        renderEntry={({address, shares, sharesOnSale}) => {
                            return [displayAddress(address), amountToPercentage(shares, TOTAL_SHARES), amountToPercentage(sharesOnSale, TOTAL_SHARES)]
                        }}
                    />
                </Box>
            );
            break;
        case 5: //Offers

            let activeOffersView;

            switch (selectedOfferTab) {
                case 0: // sell offers
                    activeOffersView = (
                        <DataView
                            display="table"
                            fields={['Id', 'Seller', 'Intended Buyer', 'Shares (%)', 'Price (eth)', 'Shares to buy (%)', 'Buy', 'Autocomplete', 'Cancel']}
                            entries={offers.sellOffers}
                            renderEntry={({id, seller, buyer, shares, price}) => {

                                if (partialShares[id] == null)
                                    partialShares[id] = 1;

                                return [
                                    id,
                                    displayAddress(seller),
                                    displayAddress(buyer),
                                    amountToPercentage(shares, TOTAL_SHARES),
                                    weiToEth(calcPartialPrice(partialShares[id], price)),
                                    <TextInput.Number
                                        value={partialShares[id]}
                                        onChange={event => setPartialShares({
                                            ...partialShares,
                                            [id]: parseFloat(event.target.value)
                                        })}
                                    />,
                                    <Button
                                        size="small"
                                        display="label"
                                        label="Buy"
                                        onClick={() => selectedAsset.buyShares(id, percentageToAmount(partialShares[id], TOTAL_SHARES), {'value': calcPartialPrice(partialShares[id], price)}).toPromise()}
                                    />,
                                    <Button
                                        size="small"
                                        display="label"
                                        label="Autocomplete"
                                        onClick={() => {
                                            if (currentUser != seller) {
                                                console.log('Error: Only the offer owner can autocomplete it.');
                                                return;
                                            }
                                            sellShares({id, seller, buyer, price, shares}, true);
                                        }}
                                    />,
                                    <Button
                                        size="small"
                                        display="label"
                                        label="Cancel"
                                        onClick={() => selectedAsset.cancelOffer(id).toPromise()}
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
                            fields={['Id', 'Buyer', 'Intended Seller', 'Shares (%)', 'Offer (eth)', 'Shares to sell (%)', 'Sell', 'Autocomplete', 'Cancel']}
                            entries={offers.buyOffers}
                            renderEntry={({id, seller, buyer, shares, price}) => {

                                if (partialShares[id] == null)
                                    partialShares[id] = 1;

                                return [
                                    id,
                                    displayAddress(buyer),
                                    displayAddress(seller),
                                    amountToPercentage(shares, TOTAL_SHARES),
                                    weiToEth(calcPartialPrice(partialShares[id], price)),
                                    <TextInput.Number
                                        value={partialShares[id]}
                                        onChange={event => setPartialShares({
                                            ...partialShares,
                                            [id]: parseFloat(event.target.value)
                                        })}
                                    />,
                                    <Button
                                        size="small"
                                        display="label"
                                        label="Sell"
                                        onClick={() => selectedAsset.sellShares(id, percentageToAmount(partialShares[id], TOTAL_SHARES)).toPromise()}
                                    />,
                                    <Button
                                        size="small"
                                        display="label"
                                        label="Autocomplete"
                                        onClick={() => {
                                            if (currentUser != buyer) {
                                                console.log('Error: Only the offer owner can autocomplete it.');
                                                return;
                                            }
                                            buyShares({id, seller, buyer, price, shares}, true);
                                        }}
                                    />,
                                    <Button
                                        size="small"
                                        display="label"
                                        label="Cancel"
                                        onClick={() => selectedAsset.cancelOffer(id).toPromise()}
                                    />
                                ]
                            }}
                        />
                    );
            }

            selectedView = (
                <Box>
                    Shares (%): <TextInput
                        css={`margin-left:83px;`}
                        type="number"
                        value={shares}
                        onChange={event => setShares(event.target.value)}
                    /> <br/>
                    Price (eth / %): <TextInput
                        css={`margin-left:58px;`}
                        type="number"
                        value={price}
                        onChange={event => setPrice(event.target.value)}
                    /> <br/>
                    Intended buyer / seller: <TextInput
                        value={intendedParty}
                        onChange={event => setIntendedParty(event.target.value)}
                    /> <br/>
                    <Checkbox
                        css={`margin-left:170px;`}
                        checked={autocompleteCheck}
                        onChange={setAutocompleteCheck}
                    /> Autocomplete <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Offer to sell"
                            onClick={() => sellShares({
                                id: null,
                                seller: currentUser,
                                buyer: (intendedParty ? intendedParty : anyAddress),
                                shares: percentageToAmount(parseFloat(shares), TOTAL_SHARES),
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
                                buyer: currentUser,
                                shares: percentageToAmount(parseFloat(shares), TOTAL_SHARES),
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
        case 6: //Proposals

            let proposalForm;

            switch ('' + selectedProposalFunction) {
                case functionIds.CHANGE_APPROVAL_TRESHOLD:
                    proposalForm = (
                        <div>
                            Current value:
                            <Text css={`margin-left:80px;`}>
                                {amountToPercentage(proposalApprovalThreshold, TOTAL_SHARES)}%
                            </Text> <br/>
                            New value: <TextInput
                                css={`margin-left:100px;`}
                                type="number"
                                value={newApprovalThreshold}
                                onChange={event => setNewApprovalThreshold(event.target.value)}
                            /> % <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.CHANGE_APPROVAL_TRESHOLD,
                                        percentageToAmount(parseFloat(newApprovalThreshold, 10), TOTAL_SHARES),
                                        '',
                                        anyAddress
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
                    break;
                case functionIds.CHANGE_ASSET_DESCRIPTION:
                    proposalForm = (
                        <div>
                            New description: <TextInput
                                css={`margin-left:60px;`}
                                value={newAssetDescription}
                                onChange={event => setNewAssetDescription(event.target.value)}
                            /> <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}

                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.CHANGE_ASSET_DESCRIPTION,
                                        0,
                                        newAssetDescription,
                                        anyAddress
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
                    break;
                case functionIds.CHANGE_PAYOUT_PERIOD:
                    proposalForm = (
                        <div>
                            Current value:
                            <Text css={`margin-left:80px;`}>{payoutPeriod} seconds </Text><br/>
                            New value: <TextInput
                                css={`margin-left:100px;`}
                                type="number"
                                value={newPayoutPeriod}
                                onChange={event => setNewPayoutPeriod(event.target.value)}
                            /> seconds <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.CHANGE_PAYOUT_PERIOD,
                                        parseInt(newPayoutPeriod, 10),
                                        '',
                                        anyAddress
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
                    break;
                case functionIds.CHANGE_TREASURY_RATIO:
                    proposalForm = (
                        <div>
                            Current value:
                            <Text css={`margin-left:80px;`}>
                                {amountToPercentage(treasuryRatio, TREASURY_RATIO_DENOMINATOR)} %
                            </Text> <br/>
                            New value: <TextInput
                                css={`margin-left:100px;`}
                                type="number"
                                value={newTreasuryRatio}
                                onChange={event => setNewTreasuryRatio(event.target.value)}
                            /> % <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.CHANGE_TREASURY_RATIO,
                                        percentageToAmount(parseFloat(newTreasuryRatio, 10), TREASURY_RATIO_DENOMINATOR),
                                        '',
                                        anyAddress
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
                    break;
                case functionIds.EXECUTE_EXTERNAL_CONTRACT:
                    proposalForm = (
                        <div>
                            Contract address: <TextInput
                                css={`margin-left:50px;`}
                                value={contractAddress}
                                onChange={event => setContractAddress(event.target.value)}
                            /> <br/>
                            Function signature: <TextInput
                                css={`margin-left:40px;`}
                                value={functionSignature}
                                onChange={event => setFunctionSignature(event.target.value)}
                            /> <br/>
                            Payment amount: <TextInput
                                css={`margin-left:50px;`}
                                type="number"
                                value={amountToSendInCall}
                                onChange={event => setAmountToSendInCall(event.target.value)}
                            /> eth <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.EXECUTE_EXTERNAL_CONTRACT,
                                        '' + ethToWei(parseFloat(amountToSendInCall)),
                                        functionSignature,
                                        contractAddress
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
                    break;
                case functionIds.ORIGINAL:
                    proposalForm = (
                        <div>
                            Proposal:
                            <TextInput
                                css={`margin-left:115px;`}
                                value={proposalText}
                                onChange={event => setProposalText(event.target.value)}
                            /> <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.ORIGINAL,
                                        0,
                                        proposalText,
                                        anyAddress
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
                    break;
                case functionIds.SEND_MONEY:
                    proposalForm = (
                        <div>
                            Address: <TextInput
                                css={`margin-left:115px;`}
                                value={addressToSend}
                                onChange={event => setAddressToSend(event.target.value)}
                            /> <br/>
                            Amount to send: <TextInput
                                css={`margin-left:60px;`}
                                type="number"
                                value={amountToSend}
                                onChange={event => setAmountToSend(event.target.value)}
                            /> eth <br/>
                            Reason: <TextInput
                                css={`margin-left:120px;`}
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            End date: <TextInput
                                css={`margin-left:105px;`}
                                type="datetime-local"
                                value={endDate}
                                onChange={event => setEndDate(event.target.value)}
                            /> <br/>
                            <Button
                                css={`margin-left:180px;`}
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    selectedAsset.makeProposal(
                                        proposalReason,
                                        dateToUnixTimestamp(new Date(endDate)),
                                        functionIds.SEND_MONEY,
                                        '' + ethToWei(parseFloat(amountToSend)),
                                        '',
                                        addressToSend
                                    ).toPromise()
                                }
                            />
                        </div>
                    );
            }

            selectedView = (
                <Box>
                    Select proposal function: <DropDown
                    items={[
                        'Change proposal approval threshold.',
                        'Change asset description.',
                        'Change payout period.',
                        'Change percentage of income placed in the treasury.',
                        'Call the function of another contract using treasury funds.',
                        'Free-form proposal.',
                        'Send money from the treasury to an address.'
                    ]}
                    selected={selectedProposalFunction}
                    onChange={setSelectedProposalFunction}
                /> <br/>
                    {proposalForm}
                    <DataView
                        display="table"
                        fields={['Id', 'Author', 'Description', 'Reason', 'Support (%)', 'End Date', 'Agree', 'Implement', 'Cancel']}
                        entries={proposals}
                        renderEntry={({id, owner, reason, expirationDate, functionId, uintArg, stringArg, addressArg, support}) => {
                            return [
                                id,
                                displayAddress(owner),
                                proposalDescription(functionId, uintArg, stringArg, addressArg),
                                reason,
                                amountToPercentage(support, TOTAL_SHARES),
                                displayDate(expirationDate),
                                <Button
                                    size="small"
                                    display="label"
                                    label="Agree"
                                    onClick={() => selectedAsset.supportProposal(id).toPromise()}
                                />,
                                <Button
                                    size="small"
                                    display="label"
                                    label="Implement"
                                    onClick={() => selectedAsset.executeProposal(id).toPromise()}
                                />,
                                <Button
                                    size="small"
                                    display="label"
                                    label="Cancel"
                                    onClick={() => selectedAsset.cancelProposal(id).toPromise()}
                                />
                            ]
                        }}
                    />
                </Box>
            );
    }

    return (
        <Main>
            <div css={`margin-left:-180px; margin-right:-180px`}>
                {isSyncing && <SyncIndicator/>}
                <Header
                    primary="AssetShare"
                    secondary= {(selectedAsset ? displayAddress(selectedAsset.address) : '')}
                />
                <Tabs
                    items={['Asset Registry', 'Asset Description', 'Your Profile', 'Payments', 'Owners', 'Offers', 'Proposals']}
                    selected={selectedTab}
                    onChange={setSelectedTab}
                />
                {selectedView}
            </div>
        </Main>
    )
}

const Buttons = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-gap: 10px;
  margin-top: 20px;
`

export default App
