pragma solidity 0.4.24;

import "../contracts/SharedAsset.sol";

contract SharedAssetTestHelper is SharedAsset {
    
    constructor(address initialOwner, string description) SharedAsset(initialOwner, description) public {
    }
    
    function callIncreaseShares(address ownerAddress, uint amount) external {
        super.increaseShares(ownerAddress, amount);
    }
    
    function callDecreaseShares(address ownerAddress, uint amount) external {
        super.decreaseShares(ownerAddress, amount);
    }
    
    function callTransferShares(address from, address to, uint sharesAmount) external {
        super.transferShares(from, to, sharesAmount);
    }
    
    function callAddOwner(address ownerAddress, uint shares) external {
        super.addOwner(ownerAddress, shares);
    }
    
    function callRemoveOwner(address ownerAddress) external {
        super.removeOwner(ownerAddress);
    }
}
