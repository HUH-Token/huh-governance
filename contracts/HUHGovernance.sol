pragma solidity ^0.8.9;
// SPDX-License-Identifier: MIT

import "hardhat/console.sol";
import "./TokenTimeLock.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
// import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";

contract HUHGovernance is Proxied, UUPSUpgradeable, OwnableUpgradeable {
    event FrozenHuhTokens(address freezer, uint amount, uint lockTime);
    event UnfrozenHuhTokens(address unfreezer, uint amount, uint lockTime);

    using SafeERC20 for IERC20;
    
    IERC20 public timeLockedToken;
    mapping(address => TokenTimeLock[]) private tokenTimeLocks;
    
    // records for upgradeability pourpose.
    TokenTimeLock[] private allTokenTimeLocks;
    
    Timestamp private timestamp;
    uint private maximumLockTime;

    function _authorizeUpgrade(address) internal override proxied {}

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) {
        init(address(0), _huhToken, _timestamp, maximumLockTimeInYears);
    }

    function init(address owner, IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears) proxied initializer public {
        // solhint-disable-next-line security/no-inline-assembly
        assembly {
            sstore(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103, owner)
        }
        __Ownable_init();
        __UUPSUpgradeable_init();
        console.log("\nDeploying Contract Initializer with %d years", maximumLockTimeInYears);
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

    // TODO uncomment on upgraded versions!
    // function onUpgrade(HUHGovernance /*_previousHUHGovernance*/) public proxied {
    //     console.log("\nUpgrading Contract");
    // }

    function getListOfTokenTimeLocks() public view onlyOwner returns (TokenTimeLock[] memory){
        return allTokenTimeLocks;
    }

    function freezeHuhTokens(address beneficiary, uint amount, uint lockTime) public {
        _freezeHuhTokens(_msgSender(), beneficiary, amount, lockTime);
    }

    function freezeMyHuhTokens(uint amount, uint lockTime) public {
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
        uint voterConciousnessOnTheSubjectUnderVote = 1; // TODO This infor should ideally come from an Oracle.
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