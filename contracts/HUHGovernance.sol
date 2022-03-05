pragma solidity ^0.8.9;
// SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "./TokenTimeLock.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract HUHGovernance is OwnableUpgradeable {
    event FrozenHuhTokens(address freezer, uint amount, uint lockTime);
    event UnfrozenHuhTokens(address unfreezer, uint amount, uint lockTime);

    using SafeERC20 for IERC20;
    
    IERC20 public timeLockedToken;
    mapping(address => TokenTimeLock[]) public tokenTimeLocks;
    Timestamp private timestamp;
    uint private maximumLockTime;

    function initialize(IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) public initializer {
    // function initialize(IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) public initializer {
        console.log("Deploying Contract Initializer with %d years", maximumLockTimeInYears);
        // SET THE OWNER HERE
        __Ownable_init();
        timeLockedToken = _huhToken;
        timestamp = _timestamp;
        maximumLockTime = timestamp.caculateYearsDeltatime(maximumLockTimeInYears);
    }

    function calculateVotingQuality(address voter) public view onlyOwner returns(uint) {
        return _calculateVotingQuality(voter);
    }


    function getTokenTimeLock(address timeLockHolder, uint tokenTimelockIndex) public view onlyOwner returns (TokenTimeLock) {
        return _getTokenTimeLock(timeLockHolder, tokenTimelockIndex);
    }

    function getTokenTimeLocks(address timeLockHolder) public view onlyOwner returns (TokenTimeLock[] memory) {
        return _getTokenTimeLocks(timeLockHolder);
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