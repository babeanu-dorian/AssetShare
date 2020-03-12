import React, {useState} from 'react'
import {useAragonApi} from '@aragon/api-react'
import {
    Box,
    Button,
    GU,
    Header,
    IconMinus,
    IconPlus,
    Main,
    SyncIndicator,
    Tabs,
    Text,
    TextInput,
    textStyle,
    DataView, IdentityBadge,
    ContextMenu,
    ContextMenuItem

} from '@aragon/ui'
import styled from 'styled-components'

function App() {
    const {api, appState, path, requestPath} = useAragonApi()
    const {treasuryBalance, funds, isSyncing,offerList,offer} = appState
    const [amount, setAmount] = useState(0)
    const [message, setMessage] = useState('')


    const pathParts = path.match(/^\/tab\/([0-9]+)/)
    const pageIndex = Array.isArray(pathParts)
        ? parseInt(pathParts[1], 10) - 1
        : 0

    return (
        <Main>
            {isSyncing && <SyncIndicator/>}
            <Header
                primary="AssetShare"
            />
            <Tabs
                items={['Tab 1', 'Tab 2']}
                selected={pageIndex}
                onChange={index => requestPath(`/tab/${index + 1}`)}
            />
            <Box>
                TreasuryBalance: {treasuryBalance} <br/>
                Funds: {funds} <br/>

                <TextInput.Number
                    label="Amount (wei)"
                    value={amount}
                    onChange={event => setAmount(parseInt(event.target.value), 10)}
                />
                <TextInput
                    label="Message"
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
                        label="Treasury deposit"
                        onClick={() => api.treasuryDeposit(message, {'value': amount}).toPromise()}
                    />
                    <Button
                        display="label"
                        label="Show array"
                        onClick={() => console.log(offerList)}
                    />


                </Buttons>
                <Button
                    display="label"
                    label="Sell offer"
                    onClick={() => offerToSell(10, 4000, '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 10000000)}
                />
                <Button
                    display="label"
                    label="Test offer to sell"
                    // onClick={() => button()}
                    onClick={() => console.log(offer)}
                />

            </Box>

            Offers that are on sale
            {getDataview()}

        </Main>
    )




    function getDataview() {
        if(showList() != null){
            return (
                <DataView
                    display="table"
                    fields={['ID', 'Sender', 'Shares', 'Price']}
                    entries={showList()}
                    renderEntry={([ID, Sender, Shares, Price]) => {
                        return [ID, <IdentityBadge entity={Sender}/>, Shares, Price]
                    }}
                    renderEntryActions={entryActions}
                />
            )
        }

    }

    // Return the contextual menu for an entry (no interaction behavior defined).
    function entryActions([account, balance]) {
        return (
            <ContextMenu>
                <ContextMenuItem>Remove tokens</ContextMenuItem>
            </ContextMenu>
        )
    }

    function offerToSell(id, price, receiver, availabilityPeriod) {
        api.offerToSell(id, price, receiver, availabilityPeriod).toPromise()
    }

    function button(){
        console.log(offerList)
    }


    function showList() {
        var array = [];
        if (offerList != null) {
                for (let i = 0; i < offerList.length; i++) {
                    var offer = offerList[i];
                    var insideArray = [offer.id, offer.seller, offer.shares, offer.price]
                    array.push(insideArray)
                }
                return array
        } else {
            return [['no data', 'no data', 'no data', 'no data']]
        }
    }

}


const Buttons = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-gap: 40px;
  margin-top: 20px;
`

export default App
