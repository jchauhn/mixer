// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleTree.sol";
import "./Verifier.sol";

contract Mixer {
    uint256 public constant DEPOSIT_AMOUNT = 0.1 ether;
    uint32 public constant TREE_DEPTH = 20;

    // Merkle tree root
    bytes32 public merkleRoot;
    // Array to store all commitment hashes
    bytes32[] public commitments;
    // Mapping to prevent double-spending
    mapping(bytes32 => bool) public nullifierUsed;

    // Verifier contract for zk-proofs
    Verifier public verifier;

    event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, bytes32 nullifierHash);

    constructor(address verifierAddress) {
        verifier = Verifier(verifierAddress);
        // Initialize Merkle tree with a zero leaf
        commitments.push(bytes32(0));
        merkleRoot = bytes32(0);
    }

    // Deposit 0.1 ETH and add commitment to Merkle tree
    function deposit(bytes32 commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Incorrect deposit amount");
        require(commitments.length < 2**TREE_DEPTH, "Tree is full");

        // Add commitment to the tree
        uint32 leafIndex = uint32(commitments.length);
        commitments.push(commitment);

        // Update Merkle root (simplified for demo; use incremental updates in production)
        bytes32[] memory leaves = new bytes32[](commitments.length);
        for (uint256 i = 0; i < commitments.length; i++) {
            leaves[i] = commitments[i];
        }
        merkleRoot = MerkleTree.getRoot(leaves);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }

    // Withdraw using zk-proof
    function withdraw(
        bytes32 nullifierHash,
        bytes32 root,
        address recipient,
        uint256[8] calldata proof
    ) external {
        require(!nullifierUsed[nullifierHash], "Nullifier already used");
        require(root == merkleRoot, "Invalid Merkle root");

        // Verify zk-proof
        require(
            verifier.verifyProof(
                [proof[0], proof[1]],
                [[proof[2], proof[3]], [proof[4], proof[5]]],
                [proof[6], proof[7]],
                [uint256(root), uint256(nullifierHash), uint256(uint160(recipient))]
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

    // Get the current number of commitments
    function getCommitmentCount() external view returns (uint256) {
        return commitments.length;
    }
}