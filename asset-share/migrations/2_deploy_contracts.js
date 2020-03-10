/* global artifacts */
var AssetShare = artifacts.require('AssetShare.sol')

module.exports = function(deployer) {
  deployer.deploy(AssetShare)
}
