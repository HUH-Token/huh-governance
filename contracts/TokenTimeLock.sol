// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Timestamp.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to extract the
 * tokens after a given release time.
 *
 * Useful for simple vesting schedules like "advisors get all of their tokens
 * after 1 year".
 */
contract TokenTimeLock is Ownable {
    using SafeERC20 for IERC20;

    // ERC20 basic token contract being held
    IERC20 immutable private _token;

    // beneficiary of tokens after they are released
    address immutable private _beneficiary;

    // timestamp when token release is enabled
    uint256 immutable private _releaseTime;

    // deltatime from lock timestamp to release time
    uint256 immutable private _deltaTime;

    uint256 immutable private _position;

    Timestamp private timestamp;

    constructor (Timestamp _timestamp, IERC20 token_, address beneficiary_, uint256 releaseTime_, uint256 position_) {
        timestamp = _timestamp;
        uint256 rightNow = timestamp.getTimestamp();
        // solhint-disable-next-line not-rely-on-time, reason-string
        require(releaseTime_ > rightNow, "TokenTimeLock: release time is before current time");
        _deltaTime = releaseTime_ - rightNow;
        _token = token_;
        _beneficiary = beneficiary_;
        _releaseTime = releaseTime_;
        _position = position_;
    }

    /**
     * @return the position of the TokenTimeLock.
     */
    function position() public view virtual returns (uint256) {
        return _position;
    }

    /**
     * @return the token being held.
     */
    function token() public view virtual returns (IERC20) {
        return _token;
    }

    /**
     * @return the beneficiary of the tokens.
     */
    function beneficiary() public view virtual returns (address) {
        return _beneficiary;
    }

    /**
     * @return the time when the tokens are released.
     */
    function deltaTime() public view virtual returns (uint256) {
        return _deltaTime;
    }

    function amount() public view virtual returns (uint256) {
        return token().balanceOf(address(this));
    }

    /**
     * @return the time when the tokens are released.
     */
    function releaseTime() public view virtual returns (uint256) {
        return _releaseTime;
    }

    /**
     * @notice Transfers tokens held by timelock to beneficiary.
     */
    function release() public virtual onlyOwner {
        // solhint-disable-next-line not-rely-on-time, reason-string
        require(timestamp.getTimestamp() >= releaseTime(), "TokenTimeLock: current time is before release time");

        uint256 _amount = amount();
        // solhint-disable-next-line reason-string
        require(_amount > 0, "TokenTimeLock: no tokens to release");

        token().safeTransfer(beneficiary(), _amount);
    }
}
