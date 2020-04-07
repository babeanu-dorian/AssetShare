pragma solidity 0.4.24;

import "@aragon/os/contracts/apps/AragonApp.sol";

import "./SharedAsset.sol";

contract AssetShareApp is AragonApp {

    event NEW_ASSET(address assetAddress);

    address[] private assetList;

    function initialize() public onlyInit {
        initialized();
    }

    function createAsset(string description) external {
        SharedAsset asset = new SharedAsset(msg.sender, description);
        assetList.push(asset);
        emit NEW_ASSET(asset);
    }

    function getAssetCount() external view returns (uint) {
        return assetList.length;
    }

    function getAssetByIdx(uint idx) external view returns (address) {
        require(idx < assetList.length);
        return assetList[idx];
    }

}