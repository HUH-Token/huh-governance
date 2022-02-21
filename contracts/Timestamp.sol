// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

contract Timestamp {

    function getTimestamp() public view returns (uint256){
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp;
    }

    function caculateYearsDeltatime(uint _years) public pure returns (uint256){
        uint oneDay = 1 days;
        return (_years * 365 + _years/4) * oneDay;
    }
}