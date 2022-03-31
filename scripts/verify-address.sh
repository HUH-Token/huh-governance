#!/bin/bash
func() {
    yarn hardhat verify "$2" --network "$1" "${@:3}"; 
}
func "$@"