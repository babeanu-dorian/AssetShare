# AssetShare
Aragon blockchain application for managing shared assets.

## Development Environment Setup

Get metamask: https://metamask.github.io/

### Linux Setup

*Note:* if any tool fails to install, try using `sudo` or `--unsafe-perm`.

Install node and npm:
```
apt-get install nodejs
```
Install aragon:
```
npm i -g @aragon/cli
```
Install ipfs:
```
npm install go-ipfs@0.4.22 --global
ipfs init
```

### Run the application

In the application project folder:
```
npm install
npm start
```

If `npm start` fails, use:

```
aragon run --files dist
```

### Run unit tests

In the application project folder:
```
npm test
```

### Development tips

Compile contracts using:
```
truffle compile
```

To reset the devchain, use:
```
aragon run --files dist --reset
```

To start the devchain with more than 2 accounts, use:
```
aragon run --files dist --accounts <number of accounts>
```

If changes are made to `contracts/SharedAsset.sol`, then `app/src/SharedAssetInterface.js` has to be updated. To do so, compile the contract, then copy the `abi` field from `app/src/SharedAsset.json`. Alternatively, use this [online compiler](http://remix.ethereum.org/).

### Deploy to mainnet or testnet

Follow [this](https://hack.aragon.org/docs/guides-publish) guide.
