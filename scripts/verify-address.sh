#!/bin/bash
func() {
    local network="$1";
    local address="$2";
    yarn hardhat verify "$address" --network "$network" "${@:3}"; 
}
func "$@"