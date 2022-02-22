pragma solidity ^0.8.9;
// SPDX-License-Identifier: MIT

import "./TokenTimeLock.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HUHGovernance is Context, Ownable{
    event FrozenHuhTokens(address freezer, uint amount, uint lockTime);
    event UnfrozenHuhTokens(address unfreezer, uint amount, uint lockTime);

    using SafeERC20 for IERC20;
    
    IERC20 immutable public timeLockedToken;
    mapping(address => TokenTimeLock[]) public tokenTimeLocks;
    Timestamp private timestamp;
    uint private maximumLockTime;

    constructor(IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears)
    {
        timeLockedToken = _huhToken;
        timestamp = _timestamp;
        maximumLockTime = timestamp.caculateYearsDeltatime(maximumLockTimeInYears);
    }

    function calculateMyVotingQuality() public view returns(uint) {
        uint myConciousnessOnTheSubjectUnderVote = 1; // TODO This infor should come from an Oracle.
        TokenTimeLock[] memory myTokenTimeLocks = getMyTokenTimeLocks();
        uint accumulator = 0;
        for (uint i = 0; i < myTokenTimeLocks.length; i++){
            uint frozenStakeForThisLock = myTokenTimeLocks[i].deltaTime() * myTokenTimeLocks[i].amount();
            uint voteQualityForThisLock = frozenStakeForThisLock * myConciousnessOnTheSubjectUnderVote;
            accumulator = accumulator + voteQualityForThisLock;
        }
        return accumulator;
    }

    function freezeHuhTokens(uint amount, uint lockTime) public {
        require(lockTime <= maximumLockTime , "Too long lockTime!");
        address freezer = _msgSender();
        uint timeStamp = timestamp.getTimestamp();
        TokenTimeLock tokenTimeLock = new TokenTimeLock(timestamp, timeLockedToken, freezer, timeStamp + lockTime);
        tokenTimeLocks[freezer].push(tokenTimeLock);
        timeLockedToken.safeTransferFrom(freezer, address(tokenTimeLock), amount);
        emit FrozenHuhTokens(_msgSender(), amount, lockTime);
    }
    
    function unfreezeHuhTokens(uint tokenTimelockIndex) public{
        address unfreezer = _msgSender();
        require(tokenTimelockIndex < tokenTimeLocks[unfreezer].length, "Index out of bounds!");
        TokenTimeLock tokenTimelock = takeTokenTimeLock(unfreezer, tokenTimelockIndex);
        uint amount = timeLockedToken.balanceOf(address(tokenTimelock));
        tokenTimelock.release();
        emit UnfrozenHuhTokens(_msgSender(), amount, tokenTimelock.deltaTime());
    }

    function getMyTokenTimeLock(uint tokenTimelockIndex) public view returns (TokenTimeLock) {
        address me = _msgSender();
        require(tokenTimelockIndex < tokenTimeLocks[me].length, "Index out of bounds!");
        return tokenTimeLocks[me][tokenTimelockIndex];
    }

    function getMyTokenTimeLocks() public view returns (TokenTimeLock[] memory) {
        return tokenTimeLocks[_msgSender()];
    }

    function takeTokenTimeLock(address sender, uint tokenTimelockIndex) internal returns (TokenTimeLock) {
        TokenTimeLock element = tokenTimeLocks[sender][tokenTimelockIndex];
        tokenTimeLocks[sender][tokenTimelockIndex] = tokenTimeLocks[sender][tokenTimeLocks[sender].length-1];
        tokenTimeLocks[sender].pop();
        return element;
    }
}