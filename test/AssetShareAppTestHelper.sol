pragma solidity 0.4.24;

import "../contracts/AssetShareApp.sol";
import "../test/SharedAssetTestHelper.sol";

contract AssetShareAppTestHelper is AssetShareApp {
    
    function createAssetHelper(string description) external {
        SharedAssetTestHelper asset = new SharedAssetTestHelper(msg.sender, description);
        assetList.push(asset);
    }
}
