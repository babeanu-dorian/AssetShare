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

} from '@aragon/ui'
import styled from 'styled-components'

function App() {
    const {api, appState, path, requestPath} = useAragonApi()
    const {treasuryBalance, funds, isSyncing, length, offer, offerList} = appState
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
                Number of offers: {length} <br/>


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
                    label="Show latest offer"
                    onClick={() => console.log(offer.seller)}
                />
                <Button
                    display="label"
                    label="Sell offer"
                    onClick={() => offerToSell(10, 2000, '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7', 10000000)}
                />
            </Box>

            Offers that are on sale
            {getDataview()}
            {console.log(returnList())}

        </Main>
    )

    function getDataview() {
        if(returnList() != null){

            return (

                <DataView
                    display="table"
                    fields={['ID', 'Sender', 'Shares', 'Price']}
                    entries={returnList()}
                    renderEntry={([ID, Sender, Shares, Price]) => {
                        return [ID, <IdentityBadge entity={Sender}/>, Shares, Price]
                    }}
                />
            )
        }

    }


    function offerToSell(id, price, receiver, availabilityPeriod) {
        api.offerToSell(id, price, receiver, availabilityPeriod).toPromise()
    }

    function returnList() {
        var array = [];
        if (offerList != null) {

            if (offerList.length != 0) {
                for (let i = 0; i < offerList.length; i++) {
                    var offer = offerList[i];
                    var insideArray = [offer.id, offer.seller, offer.shares, offer.price]
                    array.push(insideArray)
                }
                return array
            }
        } else {
            return [['null', 'null', 'null', 'null']]
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
