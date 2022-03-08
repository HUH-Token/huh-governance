pragma solidity ^0.8.9;
// SPDX-License-Identifier: MIT

import "./HUHGovernance.sol";
import "hardhat/console.sol";
import "./TokenTimeLock.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";

contract HUHGovernance_V2 is Proxied, UUPSUpgradeable, ContextUpgradeable {
    event FrozenHuhTokens(address freezer, uint amount, uint lockTime);
    event UnfrozenHuhTokens(address unfreezer, uint amount, uint lockTime);

    using SafeERC20 for IERC20;
    
    IERC20 public timeLockedToken;
    mapping(address => TokenTimeLock[]) private tokenTimeLocks;
    
    // records for upgradeability pourpose.
    TokenTimeLock[] private allTokenTimeLocks;
    TokenTimeLock[] private allTokenTimeLocksWithFunds;
    
    Timestamp private timestamp;
    uint private maximumLockTime;

    function _authorizeUpgrade(address) internal override proxied {}

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) {
        console.log("\nDeploying Contract Initializer with %d years", maximumLockTimeInYears);
        timeLockedToken = _huhToken;
        timestamp = _timestamp;
        maximumLockTime = timestamp.caculateYearsDeltatime(maximumLockTimeInYears);
    }

    function calculateVotingQuality(address voter) public view returns(uint) {
        return _calculateVotingQuality(voter);
    }

    function getTokenTimeLock(address timeLockHolder, uint tokenTimelockIndex) public view returns (TokenTimeLock) {
        return _getTokenTimeLock(timeLockHolder, tokenTimelockIndex);
    }

    function getTokenTimeLocks(address timeLockHolder) public view returns (TokenTimeLock[] memory) {
        return _getTokenTimeLocks(timeLockHolder);
    }

    function onUpgrade(HUHGovernance _previousHUHGovernance) public proxied {
        console.log("\nUpgrading Contract");
        TokenTimeLock[] memory importedTokenTimeLocks = _previousHUHGovernance.getListOfTokenTimeLocks();
        for (uint i = 0; i < importedTokenTimeLocks.length; i++){
            TokenTimeLock selectedTimeLock = importedTokenTimeLocks[i];
            tokenTimeLocks[selectedTimeLock.beneficiary()].push(selectedTimeLock);
            allTokenTimeLocks.push(selectedTimeLock);
        }
    }

    function getListOfTokenTimeLocks() public returns (TokenTimeLock[] memory){
        for (uint i = 0; i < allTokenTimeLocksWithFunds.length; i++){
            TokenTimeLock selectedTimeLock = allTokenTimeLocksWithFunds[i];
            if (selectedTimeLock.amount() > 0){
                allTokenTimeLocksWithFunds.push(selectedTimeLock);
            }
        }
        return allTokenTimeLocksWithFunds;
    }

    function freezeHuhTokens(address recipient, uint amount, uint lockTime) public {
        _freezeHuhTokens(recipient, amount, lockTime);
    }

    function freezeMyHuhTokens(uint amount, uint lockTime) public {
        _freezeHuhTokens(_msgSender(), amount, lockTime);
    }
    
    function _freezeHuhTokens(address freezer, uint amount, uint lockTime) internal {
        require(lockTime <= maximumLockTime , "Too long lockTime!");
        uint timeStamp = timestamp.getTimestamp();
        TokenTimeLock tokenTimeLock = new TokenTimeLock(timestamp, timeLockedToken, freezer, timeStamp + lockTime);
        tokenTimeLocks[freezer].push(tokenTimeLock);
        // record for upgradeability pourpose.
        allTokenTimeLocks.push(tokenTimeLock);
        timeLockedToken.safeTransferFrom(freezer, address(tokenTimeLock), amount);
        emit FrozenHuhTokens(freezer, amount, lockTime);
    }

    function unfreezeHuhTokens(uint tokenTimelockIndex) public{
        address unfreezer = _msgSender();
        require(tokenTimelockIndex < tokenTimeLocks[unfreezer].length, "Index out of bounds!");
        TokenTimeLock tokenTimelock = _takeTokenTimeLock(unfreezer, tokenTimelockIndex);
        uint amount = timeLockedToken.balanceOf(address(tokenTimelock));
        tokenTimelock.release();
        emit UnfrozenHuhTokens(_msgSender(), amount, tokenTimelock.deltaTime());
    }

    function calculateMyVotingQuality() public view returns(uint) {
        return _calculateVotingQuality(_msgSender());
    }

    function getMyTokenTimeLock(uint tokenTimelockIndex) public view returns (TokenTimeLock) {
        return _getTokenTimeLock(_msgSender(), tokenTimelockIndex);
    }

    function getMyTokenTimeLocks() public view returns (TokenTimeLock[] memory) {
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
        tokenTimeLocks[timeLockHolder].pop();
        return element;
    }
}