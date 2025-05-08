// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "./Verifier.sol";

// interface IPoseidon {
//     function poseidon2(bytes32[2] calldata input) external pure returns (bytes32);
// }

contract Mixer is MerkleTreeWithHistory {
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;

    // Mapping to prevent double-spending
    mapping(uint256 => bool) public nullifierUsed;
    uint256[] public commitments;
    uint256 public defaultCommitment = 0x1f04ef20dee48d39984d8eabe768a70eafa6310ad20849d4573c3c40c2ad1e30;
    uint32 public level = 0; 
    // Verifier contract for zk-proofs
    Groth16Verifier public verifier;
    // Poseidon contract for hashing
    // IPoseidon public poseidoner;


    event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, uint256 nullifierHash);

    constructor(uint32 _levels, address verifierAddress, address _poseidonAddress) MerkleTreeWithHistory(_levels, _poseidonAddress) {
        // for (uint32 i = 0; i < 2**_levels; i++) {
        //     commitments.push(bytes32(0x1f04ef20dee48d39984d8eabe768a70eafa6310ad20849d4573c3c40c2ad1e30));
        // }
        level = _levels;
        verifier = Groth16Verifier(verifierAddress);
        // poseidoner = IPoseidon(_poseidonAddress);
    }

    // Deposit 0.1 ETH and add commitment to Merkle tree
    function deposit(uint256 commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Incorrect deposit amount");
        
        // Add commitment to the tree using the parent's _insert method
        uint32 leafIndex = _insert(commitment);
        // uint32 leafIndex = 0;
        commitments.push(commitment);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }

    // Withdraw using zk-proof
    function withdraw(
        uint256 nullifierHash,
        uint256 root,
        address recipient,
        uint256[11] calldata proof
    ) external {
        require(!nullifierUsed[nullifierHash], "Nullifier already used");
        require(isKnownRoot(root), "Invalid Merkle root");

        // Verify zk-proof
        require(
            verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [proof[8], proof[9], proof[10]]
            ),
            "Invalid proof"
        );

        // Mark nullifier as used
        nullifierUsed[nullifierHash] = true;

        // Send 0.1 ETH to recipient
        (bool success, ) = recipient.call{value: DEPOSIT_AMOUNT}("");
        require(success, "Transfer failed");

        emit Withdrawal(recipient, nullifierHash);
    }

    // // Get a specific commitment by index for testing
    // function getCommitment(uint256 index) external view returns (bytes32) {
    //     require(index < getCommitmentCount(), "Index out of bounds");
    //     // This function will need a different implementation since MerkleTreeWithHistory
    //     // doesn't store commitments in an array like the original Mixer
    //     revert("Not implemented");
    // }

    // Get the current number of commitments
    function getCommitmentCount() public view returns (uint256) {
        return nextIndex;
    }

    function getAllCommitments() external view returns (uint256[] memory) {
        return commitments;
    }

    function getDefaultCommitment() external view returns (uint256) {
        return defaultCommitment;
    }

    function getLevel() external view returns (uint32) {
        return level;
    }

    // Get the current Merkle root
    function getMerkleRoot() external view returns (uint256) {
        return getLastRoot();
    }
}