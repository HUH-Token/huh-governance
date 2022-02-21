pragma solidity ^0.8.9;
// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./TokenTimeLock.sol";
import "./Timestamp.sol";

contract TokenTimeLockHandler is Context, Ownable{
    using SafeERC20 for IERC20;
    
    IERC20 immutable public timeLockedToken;
    mapping(address => TokenTimeLock[]) public tokenTimeLocks;
    Timestamp private timestamp;
    uint private maximumLockTime;

    constructor(IERC20 _timeLockedToken, Timestamp _timestamp, uint _maximumLockTime){
        timeLockedToken = _timeLockedToken;
        timestamp = _timestamp;
        maximumLockTime = _maximumLockTime;
    }

    function deposit(uint amount, uint lockTime) public {
        require(lockTime < maximumLockTime , "Too long lockTime!");
        address depositor = _msgSender();
        timeLockedToken.safeTransferFrom(depositor, address(this), amount);
        uint timeStamp = timestamp.getTimestamp();
        TokenTimeLock tokenTimeLock = new TokenTimeLock(timestamp, timeLockedToken, depositor, timeStamp + lockTime);
        tokenTimeLocks[depositor].push(tokenTimeLock);
    }

    function getMyTokenTimeLock(uint tokenTimelockIndex) public view returns (TokenTimeLock) {
        address me = _msgSender();
        require(tokenTimelockIndex < tokenTimeLocks[me].length, "Index out of bounds!");
        return tokenTimeLocks[me][tokenTimelockIndex];
    }

    function getMyTokenTimeLocks() public view returns (TokenTimeLock[] memory) {
        return tokenTimeLocks[_msgSender()];
    }

    function releaseTokens(uint tokenTimelockIndex) public returns(uint){
        address releaser = _msgSender();
        require(tokenTimelockIndex < tokenTimeLocks[releaser].length, "Index out of bounds!");
        TokenTimeLock tokenTimelock = takeTokenTimeLock(releaser, tokenTimelockIndex);
        uint amount = timeLockedToken.balanceOf(address(tokenTimelock));
        tokenTimelock.release();
        return amount;
    }

    function takeTokenTimeLock(address sender, uint tokenTimelockIndex) internal returns (TokenTimeLock) {
        TokenTimeLock element = tokenTimeLocks[sender][tokenTimelockIndex];
        uint lengthM1 = tokenTimeLocks[sender].length - 1;
        tokenTimeLocks[sender][tokenTimelockIndex] = tokenTimeLocks[sender][lengthM1];
        delete tokenTimeLocks[sender][lengthM1];
        tokenTimeLocks[sender].pop;
        return element;
    }
}