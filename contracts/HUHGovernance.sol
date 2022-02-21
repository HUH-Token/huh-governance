pragma solidity ^0.8.9;
// SPDX-License-Identifier: MIT

import "./TokenTimeLock.sol";
import "./TokenTimeLockHandler.sol";

contract HUHGovernance is TokenTimeLockHandler{
    event HuhTokenRelease(address releaser, uint amount);

    constructor(IERC20 _huhToken, Timestamp _timestamp, uint maximumLockTimeInYears)
        TokenTimeLockHandler(
            _huhToken, 
            _timestamp,
            _timestamp.caculateYearsDeltatime(maximumLockTimeInYears)){
    }

    function calculateMyVotingQuality() public view returns(uint) {
        uint myConciousnessOnTheSubjectUnderVote = 1; // TODO
        TokenTimeLock[] memory myTokenTimeLocks = getMyTokenTimeLocks();
        uint accumulator = 0;
        for (uint i = 0; i < myTokenTimeLocks.length; i++){
            uint frozenStakeForThisLock = myTokenTimeLocks[i].deltaTime() * myTokenTimeLocks[i].amount();
            uint voteQualityForThisLock = frozenStakeForThisLock * myConciousnessOnTheSubjectUnderVote;
            accumulator = accumulator + voteQualityForThisLock;
        }
        return accumulator;
    }

    function releaseHuhTokens(uint tokenTimelockIndex) public {
        uint amount = super.releaseTokens(tokenTimelockIndex);
        emit HuhTokenRelease(_msgSender(), amount);
    }
}