import React, { useState } from 'react'
import { useAragonApi } from '@aragon/api-react'
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
} from '@aragon/ui'
import styled from 'styled-components'

function App() {
  const { api, appState, path, requestPath } = useAragonApi()
  const { treasuryBalance, funds, isSyncing, offer, sharesAmount } = appState
  const [ amount, setAmount ] = useState(0)
  const [ message, setMessage] = useState('')

  const pathParts = path.match(/^\/tab\/([0-9]+)/)
  const pageIndex = Array.isArray(pathParts)
    ? parseInt(pathParts[1], 10) - 1
    : 0

  return (
    <Main>
      {isSyncing && <SyncIndicator />}
      <Header
        primary="AssetShare"
      />
      <Tabs
        items={['Tab 1', 'Tab 2']}
        selected={pageIndex}
        onChange={index => requestPath(`/tab/${index + 1}`)}
      />
      <Box
        css={`
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: ${50 * GU}px;
          ${textStyle('title3')};
        `}
      >
        TreasuryBalance: {treasuryBalance} <br />
        Funds: {funds} <br />
        OfferSelled: {offer} <br />
        SharesAmount: {sharesAmount} <br />


        <TextInput.Number
          label="Amount (wei)"
          value={amount}
          onChange={ event => setAmount(parseInt(event.target.value), 10) }
        />
        <TextInput
          label="Message"
          value={message}
          onChange={ event => setMessage(event.target.value) }
        /> <br />
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

        </Buttons>

        <Button
          display="label"
          label="Sell offer"
          onClick={() => api.offerToSell(10, 1000,'0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb', 10000000).toPromise()}
      />
      </Box>
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
