pragma solidity 0.8.9;
// SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "./TokenTimeLock.sol";
import "./HUHGovernance.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";

// solhint-disable-next-line contract-name-camelcase
contract HUHGovernance_V2 is Proxied, UUPSUpgradeable, OwnableUpgradeable {
    event ProxyOwnershipTransferred(address from, address to);
    event FrozenHuhTokens(address freezer, uint amount, uint lockTime);
    event UnfrozenHuhTokens(address unfreezer, uint amount, uint lockTime);

    using SafeERC20Upgradeable for IERC20Upgradeable;
    
    IERC20Upgradeable public timeLockedToken;
    mapping(address => TokenTimeLock[]) private tokenTimeLocks;
    
    // records for upgradeability pourpose.
    TokenTimeLock[] private allTokenTimeLocks;
    
    Timestamp private timestamp;
    uint private maximumLockTime;

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override proxied {}

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(IERC20Upgradeable _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) {
        init(address(0), _huhToken, _timestamp, maximumLockTimeInYears);
    }

    function init(address proxyAdmin, IERC20Upgradeable _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) public proxied initializer {
        _transferProxyOwnership(proxyAdmin);
        __Ownable_init();
        __UUPSUpgradeable_init();
        // console.log("\nDeploying Contract Initializer with %d years", maximumLockTimeInYears);
        timeLockedToken = _huhToken;
        timestamp = _timestamp;
        maximumLockTime = timestamp.caculateYearsDeltatime(maximumLockTimeInYears);
    }

    function getProxyAdmin() external view returns (address) {
        return _proxyAdmin();
    }

    function _transferProxyOwnership(address newProxyAdmin) internal {
        address previousProxyAdmin = _proxyAdmin();
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103, newProxyAdmin)
        }
        emit ProxyOwnershipTransferred(previousProxyAdmin, newProxyAdmin);
    }

    function transferProxyOwnership(address newProxyAdmin) external onlyProxyAdmin {
        _transferProxyOwnership(newProxyAdmin);
    }

    function calculateVotingQuality(address voter) external view onlyOwner returns(uint) {
        return _calculateVotingQuality(voter);
    }

    function getTokenTimeLock(address timeLockHolder, uint tokenTimelockIndex) external view onlyOwner returns (TokenTimeLock) {
        return _getTokenTimeLock(timeLockHolder, tokenTimelockIndex);
    }

    function getTokenTimeLocks(address timeLockHolder) external view onlyOwner returns (TokenTimeLock[] memory) {
        return _getTokenTimeLocks(timeLockHolder);
    }

    // TODO uncomment on upgraded versions!
    function onUpgrade(HUHGovernance /*_previousHUHGovernance*/) public proxied {
        // console.log("\nUpgrading Contract from account %s.", _msgSender());
        _transferProxyOwnership(_msgSender());
    }

    function getListOfTokenTimeLocks() external view onlyOwner returns (TokenTimeLock[] memory){
        return allTokenTimeLocks;
    }

    function freezeHuhTokens(address beneficiary, uint amount, uint lockTime) external {
        _freezeHuhTokens(_msgSender(), beneficiary, amount, lockTime);
    }

    function freezeMyHuhTokens(uint amount, uint lockTime) external {
        _freezeHuhTokens(_msgSender(), _msgSender(), amount, lockTime);
    }
    
    function _freezeHuhTokens(address freezer, address beneficiary, uint amount, uint lockTime) internal {
        require(lockTime <= maximumLockTime , "Too long lockTime!");
        require(amount > 0, "Too low amount!");
        uint timeStamp = timestamp.getTimestamp();
        TokenTimeLock tokenTimeLock = new TokenTimeLock(timestamp, timeLockedToken, beneficiary, timeStamp + lockTime, allTokenTimeLocks.length);
        tokenTimeLocks[beneficiary].push(tokenTimeLock);
        // record for upgradeability pourpose.
        allTokenTimeLocks.push(tokenTimeLock);
        timeLockedToken.safeTransferFrom(freezer, address(tokenTimeLock), amount);
        emit FrozenHuhTokens(beneficiary, amount, lockTime);
    }

    function unfreezeHuhTokens(uint tokenTimelockIndex) external {
        address unfreezer = _msgSender();
        require(tokenTimelockIndex < tokenTimeLocks[unfreezer].length, "Index out of bounds!");
        TokenTimeLock tokenTimelock = _takeTokenTimeLock(unfreezer, tokenTimelockIndex);
        uint amount = timeLockedToken.balanceOf(address(tokenTimelock));
        tokenTimelock.release();
        emit UnfrozenHuhTokens(_msgSender(), amount, tokenTimelock.deltaTime());
    }

    function calculateMyVotingQuality() external view returns(uint) {
        return _calculateVotingQuality(_msgSender());
    }

    function getMyTokenTimeLock(uint tokenTimelockIndex) external view returns (TokenTimeLock) {
        return _getTokenTimeLock(_msgSender(), tokenTimelockIndex);
    }

    function getMyTokenTimeLocks() external view returns (TokenTimeLock[] memory) {
        return _getTokenTimeLocks(_msgSender());
    }

    function _calculateVotingQuality(address voter) internal view returns(uint) {
        uint voterConciousnessOnTheSubjectUnderVote = 2; // TODO This infor should ideally come from an Oracle.
        TokenTimeLock[] memory voterTokenTimeLocks = _getTokenTimeLocks(voter);
        uint accumulator = 0;
        for (uint i = 0; i < voterTokenTimeLocks.length; i++){
            uint frozenStakeForThisLock = voterTokenTimeLocks[i].deltaTime() * voterTokenTimeLocks[i].amount();
            uint voteQualityForThisLock = frozenStakeForThisLock * voterConciousnessOnTheSubjectUnderVote;
            accumulator = accumulator + voteQualityForThisLock;
        }
        return accumulator;
    }

    function _getTokenTimeLock(address timeLockHolder, uint tokenTimelockIndex) internal view returns (TokenTimeLock) {
        require(tokenTimelockIndex < tokenTimeLocks[timeLockHolder].length, "Index out of bounds!");
        return tokenTimeLocks[timeLockHolder][tokenTimelockIndex];
    }

    function _getTokenTimeLocks(address timeLockHolder) internal view returns (TokenTimeLock[] memory) {
        return tokenTimeLocks[timeLockHolder];
    }

    function _takeTokenTimeLock(address timeLockHolder, uint tokenTimelockIndex) internal returns (TokenTimeLock) {
        TokenTimeLock element = tokenTimeLocks[timeLockHolder][tokenTimelockIndex];
        tokenTimeLocks[timeLockHolder][tokenTimelockIndex] = tokenTimeLocks[timeLockHolder][tokenTimeLocks[timeLockHolder].length-1];
        allTokenTimeLocks[element.position()] = allTokenTimeLocks[allTokenTimeLocks.length-1];
        allTokenTimeLocks.pop();
        tokenTimeLocks[timeLockHolder].pop();
        return element;
    }
}