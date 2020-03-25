pragma solidity 0.4.24;

import "../contracts/AssetShareApp.sol";

contract AssetShareAppHelper is AssetShareApp {
    
    function callAddOwner(address ownerAddress, uint shares) external {
        super.addOwner(ownerAddress, shares);
    }
}
