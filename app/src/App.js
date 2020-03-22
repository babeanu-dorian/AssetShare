import React, {useState} from 'react'
import {useAragonApi} from '@aragon/api-react'
import {
    AddressField,
    Box,
    Button,
    DataView,
    DropDown,
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
    ContextMenuItem

} from '@aragon/ui'
import styled from 'styled-components'

function App() {
    const {api, appState, path, connectedAccount} = useAragonApi();
    const {
        TOTAL_SHARES,
        TREASURY_RATIO_DENOMINATOR,
        functionIds,
        assetDescription,
        treasuryRatio,
        payoutPeriod,
        proposalApprovalThreshold,
        treasuryBalance,
        funds,
        owners,
        offers,
        proposals,
        supportedProposal,
        isSyncing
    } = appState;
    const [selectedTab, setSelectedTab] = useState(0);
    const [amount, setAmount] = useState('');
    const [message, setMessage] = useState('');
    const [shares, setShares] = useState('');
    const [price, setPrice] = useState('');
    const [intendedBuyer, setIntendedBuyer] = useState('');
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
    const [proposalReason, setProposalReason] = useState('');
    const anyAddress = '0x0000000000000000000000000000000000000000';

    function percentageToAmount(percentage, total) {
        return percentage * total / 100;
    }

    function amountToPercentage(amount, total) {
        return amount * 100 / total;
    }

    function displayAddress(address) {
        return (address == anyAddress ? '-' : <IdentityBadge entity={address}/>);
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
                       + uintArg
                       + ' wei to call function '
                       + stringArg
                       + ' of contract '
                       + displayAddress(addressArg)
                       + '.'; 
            case functionIds.SEND_MONEY:
                return 'Transfer '
                       + uintArg
                       + ' wei to '
                       + displayAddress(addressArg)
                       + '.';
        }
        return '';
    }

    let selectedView;

    switch (selectedTab) {
        case 0: //Asset
            selectedView = (
                <Box>{assetDescription}</Box>
            );
            break;
        case 1: //Payments
            selectedView = (
                <Box>
                    TreasuryBalance: {treasuryBalance} <br/>
                    Funds: {funds} <br/>

                    Amount (wei): <TextInput.Number
                        value={amount}
                        onChange={event => setAmount(event.target.value)}
                    /> <br/>
                    Message: <TextInput
                        value={message}
                        onChange={event => setMessage(event.target.value)}
                    /> <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Make payment"
                            onClick={() => api.payment(message, {'value': parseInt(amount, 10)}).toPromise()}
                        />
                        <Button
                            display="label"
                            label="Deposit to treasury"
                            onClick={() => api.treasuryDeposit(message, {'value': parseInt(amount, 10)}).toPromise()}
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
        case 2: //Owners
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
        case 3: //Offers
            selectedView = (
                <Box>
                    Shares to sell (%): <TextInput.Number
                        value={shares}
                        onChange={event => setShares(event.target.value)}
                    /> <br/>
                    Price (wei): <TextInput.Number
                        value={price}
                        onChange={event => setPrice(event.target.value)}
                    /> <br/>
                    Intended buyer: <TextInput
                        value={intendedBuyer}
                        onChange={event => setIntendedBuyer(event.target.value)}
                    /> <br/>
                    <Buttons>
                        <Button
                            display="label"
                            label="Publish Offer"
                            onClick={() => api.offerToSell(percentageToAmount(parseFloat(shares, 10), TOTAL_SHARES),
                                parseInt(price, 10), (intendedBuyer ? intendedBuyer : anyAddress)).toPromise()}
                        />
                    </Buttons>
                    <DataView
                        display="table"
                        fields={['Id', 'Seller', 'Inteded Buyer', 'Shares (%)', 'Price (wei)', 'Buy', 'Cancel']}
                        entries={offers}
                        renderEntry={({id, seller, buyer, shares, price}) => {
                            return [
                                id,
                                displayAddress(seller),
                                displayAddress(buyer),
                                amountToPercentage(shares, TOTAL_SHARES),
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
            );
            break;
        case 4: //Proposals

            let proposalForm;

            switch ('' + selectedProposalFunction) {
                case functionIds.CHANGE_APPROVAL_TRESHOLD:
                    proposalForm = (
                        <div>
                            Current value: {amountToPercentage(proposalApprovalThreshold, TOTAL_SHARES)} % <br/>
                            New value: <TextInput.Number
                                value={newApprovalThreshold}
                                onChange={event => setNewApprovalThreshold(event.target.value)}
                            /> % <br/>
                            Reason: <TextInput
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            <Button
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    api.makeProposal(
                                        proposalReason,
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
                            New description:<br/>
                            <TextInput
                                value={newAssetDescription}
                                onChange={event => setNewAssetDescription(event.target.value)}
                            /> <br/>
                            Reason: <TextInput
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            <Button
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    api.makeProposal(
                                        proposalReason,
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
                            Current value: {payoutPeriod} seconds <br/>
                            New value: <TextInput.Number
                                value={newPayoutPeriod}
                                onChange={event => setNewPayoutPeriod(event.target.value)}
                            /> seconds <br/>
                            Reason: <TextInput
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            <Button
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    api.makeProposal(
                                        proposalReason,
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
                            Current value: {amountToPercentage(treasuryRatio, TREASURY_RATIO_DENOMINATOR)} % <br/>
                            New value: <TextInput.Number
                                value={newTreasuryRatio}
                                onChange={event => setNewTreasuryRatio(event.target.value)}
                            /> % <br/>
                            Reason: <TextInput
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            <Button
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    api.makeProposal(
                                        proposalReason,
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
                                value={contractAddress}
                                onChange={event => setContractAddress(event.target.value)}
                            /> <br/>
                            Function signature: <TextInput
                                value={functionSignature}
                                onChange={event => setFunctionSignature(event.target.value)}
                            /> <br/>
                            Payment amount: <TextInput.Number
                                value={amountToSendInCall}
                                onChange={event => setAmountToSendInCall(event.target.value)}
                            /> wei <br/>
                            Reason: <TextInput
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            <Button
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    api.makeProposal(
                                        proposalReason,
                                        functionIds.EXECUTE_EXTERNAL_CONTRACT,
                                        parseInt(amountToSendInCall, 10),
                                        functionSignature,
                                        contractAddress
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
                                value={addressToSend}
                                onChange={event => setAddressToSend(event.target.value)}
                            /> <br/>
                            Amount to send: <TextInput.Number
                                value={amountToSend}
                                onChange={event => setAmountToSend(event.target.value)}
                            /> wei <br/>
                            Reason: <TextInput
                                value={proposalReason}
                                onChange={event => setProposalReason(event.target.value)}
                            /> <br/>
                            <Button
                                display="label"
                                label="Make proposal"
                                onClick={() =>
                                    api.makeProposal(
                                        proposalReason,
                                        functionIds.SEND_MONEY,
                                        parseInt(amountToSend, 10),
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
                            'Send money from the treasury to an address.'
                        ]}
                        selected={selectedProposalFunction}
                        onChange={setSelectedProposalFunction}
                    /> <br/>
                    {proposalForm}
                    <DataView
                        display="table"
                        fields={['Id', 'Author', 'Description', 'Reason', 'Support (%)', 'Agree', 'Implement', 'Cancel']}
                        entries={proposals}
                        renderEntry={({id, owner, reason, functionId, uintArg, stringArg, addressArg, support}) => {
                            return [
                                id,
                                displayAddress(owner),
                                proposalDescription(functionId, uintArg, stringArg, addressArg),
                                reason,
                                amountToPercentage(support, TOTAL_SHARES),
                                <Button
                                    display="label"
                                    label="Agree"
                                    onClick={() => api.supportProposal(id).toPromise()}
                                />,
                                <Button
                                    display="label"
                                    label="Implement"
                                    onClick={() => api.executeProposal(id).toPromise()}
                                />,
                                <Button
                                    display="label"
                                    label="Cancel"
                                    onClick={() => api.cancelProposal(id).toPromise()}
                                />
                            ]
                        }}
                    />
                </Box>
            );
    }

    return (
        <Main>
            {isSyncing && <SyncIndicator/>}
            <Header
                primary="AssetShare"
            />
            <Tabs
                items={['Asset', 'Payments', 'Owners', 'Offers', 'Proposals']}
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
