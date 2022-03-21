// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

contract Timestamp {

    function getTimestamp() external view returns (uint256){
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp;
    }

    function caculateYearsDeltatime(uint _years) external pure returns (uint256){
        uint oneDay = 1 days;
        return ((_years * 3652425 + 5000)/ 10000) * oneDay;
    }
}