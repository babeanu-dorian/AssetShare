pragma solidity 0.4.24;

import "../contracts/AssetShareApp.sol";

contract AssetShareAppTestHelper is AssetShareApp {
    
    function callAddOwner(address ownerAddress, uint shares) external {
        super.addOwner(ownerAddress, shares);
    }
}
