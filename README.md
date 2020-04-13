# AssetShare
Aragon blockchain application for managing shared assets.

## Development Environment Setup

Get metamask: https://metamask.github.io/

### Linux Setup

Install node and npm:
```
sudo apt-get install nodejs
```
Install aragon:
```
sudo npm i -g --unsafe-perm @aragon/cli
```
Install ipfs:
```
sudo npm install go-ipfs@0.4.22 --global
ipfs init
```

### Run the application

In the application project folder:
```
npm install
npm start
```

If npm start fails, use:

```
aragon run --files dist
```

### Run unit tests

In the application project folder:
```
npm test
```
