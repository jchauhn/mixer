# Cryptocurrency Mixer
##### _Jyotirmay & Nishant_

[![Build Status](https://travis-ci.org/joemccann/dillinger.svg?branch=master)](https://github.com/jchauhn/mixer)

## 1. Introduction

This document provides a technical overview of a basic cryptocurrency mixer, a privacy-enhancing tool. This Proof of Concept (POC) aims to demonstrate the fundamental principles of using zk-SNARKs (Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge) and Merkle trees to obscure the link between cryptocurrency deposits and withdrawals on a private blockchain like Ethereum. 

zk-SNARKs, represent a significant advancement in cryptographic techniques, offering the
capability to prove the validity of a statement without revealing any information
beyond its truth. This technology holds potential for privacy-preserving
applications, particularly within the realm of cryptocurrency mixers, which aim to
obscure the transaction history and identities of participants. The objective is to evaluate the underlying principles, propose a design, provide a comprehensive architectural overview, and offer specific suggestions for the content of our concise project.


## 2. System Overview

The cryptocurrency mixer allows users to deposit a fixed amount of Ether (0.1 ETH in this version) into a smart contract and later withdraw it to a different address, aiming to break the direct on-chain link between the deposit and withdrawal. The core components of the system are:

- **Smart Contract (Solidity):** Deployed on the Ethereum blockchain, this contract is the central hub of the mixer. It manages the deposit process, stores cryptographic commitments in a Merkle tree, and verifies zero-knowledge proofs during the withdrawal process.

- **Circom Circuits:** These are used to define the logic for generating zero-knowledge proofs. The circuit in this project is designed to prove that a user's deposit commitment is part of the Merkle tree and that they know the secret and nullifier associated with it, all without revealing this information.

- **Client-Side Logic (HTML/JavaScript):** This provides a web interface for users to interact with the mixer. It handles user actions like initiating a deposit and a withdrawal, generates the necessary cryptographic data, and sends transactions to the smart contract.

## 3. Deposit Workflow

A step-by-step breakdown of the deposit process which allows a user to contribute Ether to the mixer in a way that their transaction history becomes harder to trace:

[![Deposit.png](https://i.postimg.cc/CKwsH4JB/temp-Image-Kvh-RZg.avif
)](https://postimg.cc/hfB8QW6r)

#### 3.1 User Initiates Deposit:

The user interacts with the client-side web application and clicks the "Deposit 0.1 ETH" button. This action triggers the deposit functionality in the JavaScript code.

#### 3.2 Secret and Nullifier Generation (Client-Side):

When a user wants to deposit, their browser generates two random, secret numbers: a secret and a nullifier.

```JavaScript
const secret = convertToBigInt(await generateRandomFieldElement());
  const nullifier = convertToBigInt(await generateRandomFieldElement());
  
```

**Secret:** This is a random value kept secret by the user. It's part of the information needed later to prove their right to withdraw the funds without revealing the deposit itself like a private key for their deposit within the mixer.

**Nullifier:** This is another random value, also kept secret. It plays a crucial role in preventing double-spending. Each withdrawal will use a unique nullifier, and the system will save nullifiers already used for withdrawls to ensure that the same deposit cannot be withdrawn multiple times.



#### 3.3 Commitment Creation (Client-Side):

Next, the client-side code combines the secret and the nullifier to create a commitment. This commitment acts as a unique, but initially hidden, identifier for the user's deposit.

```JavaScript
const commitment = poseidon([secret, nullifier]);
  const commitmentObject_bigint = poseidon.F.toObject(commitment);

```

- The commitmentInput is an array containing the secret and nullifier. 
- The `poseidon()` function is used to hash these two secret values together. Poseidon is a type of cryptographic hash function that is particularly efficient for use in zk-SNARK circuits. It is imported via `const { buildPoseidon } = require("circomlibjs");`
- The commitment is then converted to a BigInt `commitment` which accepts smart contract.

 When the user makes a deposit, only this commitment is sent to the smart contract, keeping the actual secret and nullifier hidden.

#### 3.4 Deposit Transaction to Smart Contract (Client-Side):

The client-side code then uses the hardhat's built in library to send a transaction to the local blockchain Mixer smart contract.

Refer to README.md for the code.

#### 3.5 Smart Contract Receives Deposit:

The deposit function in the Mixer smart contract is executed when the transaction is received.

```JavaScript
function deposit(uint256 commitment) external payable {
        require(msg.value == DEPOSIT_AMOUNT, "Incorrect deposit amount");
        
        // Add commitment to the tree using the parent's _insert method
        uint32 leafIndex = _insert(commitment);
        // uint32 leafIndex = 0;
        commitments.push(commitment);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }
```

- **Amount Check:** `require(msg.value == DEPOSIT_AMOUNT, "Incorrect deposit amount");` ensures that the user has sent the correct deposit amount (0.1 ETH).

- **Tree Full Check:** `uint32 leafIndex = _insert(commitment);` inserts the element into the contract's minimal merkle tree and updates the root.

- **Commitment Storage:** `commitments.push(commitment);` adds the received commitment to the commitments array. This array stores all the deposit commitments and acts as the leaves of the Merkle tree.



- **Deposit Event:** `emit Deposit(commitment, uint32(commitments.length - 1), block.timestamp);` emits an event, recording the deposit. This event includes the commitment, the index of the commitment in the Merkle tree, and the timestamp of the deposit.

## 4. Withdrawal Workflow

The withdrawal process allows a user to anonymously retrieve their deposited Ether to a new address. 

[![Withdrawal.png](https://i.postimg.cc/pLfBFSQM/temp-Imageb28dh-M.avif
)](https://postimg.cc/D8stTXbz)

Here's a high-level overview of the intended steps and the current implementation:

#### 4.1 User Initiates Withdrawal:


The client-side code retrieves the secret, nullifier, and commitment.

#### 4.2 Fetching Commitments and Constructing Merkle Tree (Client-Side):

To generate the zero-knowledge proof required for withdrawal, the client needs to know the current state of the Merkle tree. The client-side code now fetches all the commitments stored in the smart contract.



```JavaScript
const commitments = await mixer.getAllCommitments();
const defaultCommitment = await mixer
getDefaultCommitment();
const level = Number(await mixer.getLevel());
```

And the merkle tree is generaeted by the function.

```Javascript
async function generateMerkleProof(commitments, targetLeaf)
```
`all_leaves` are all the added commitments. 
`target_leaf` is the commitment we care about.







#### 4.3 Generating zk-SNARK Proof (Client-Side):


The next step involves using the snarkjs library and the Circom-generated WASM and ZKEY files to generate a zero-knowledge proof. This proof takes the secret, nullifier, pathElements, pathIndices, and the root, as input and proves:
- The user knows the secret and nullifier that generated the commitment.
- The commitment is included in the Merkle tree with the given root (using the provided Merkle proof).
- The nullifier hash is computed correctly.

#### 4.4 Sending Withdrawal Transaction:

Once the zk-SNARK proof is generated, the client-side code sends a transaction to the withdraw function of the Mixer smart contract, providing:

- The `nullifierHash` (derived from the nullifier).
- The root of the Merkle tree.
- The recipient address for the withdrawal.
- The generated zk-SNARK proof.

#### 4.5 Smart Contract Verifies Withdrawal:

The withdraw function in the Mixer smart contract then performs the following checks:

```JavaScript
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
```

- **Nullifier Used Check:** `require(!nullifierUsed[nullifierHash], "Nullifier already used");` ensures that the nullifier associated with this withdrawal has not been used before, preventing double-spending.
- **Merkle Root Check:** `require(root == merkleRoot, "Invalid Merkle root");` verifies that the Merkle root provided in the withdrawal transaction matches the current Merkle root stored in the smart contract. This ensures the proof is for a recent state of the deposits.
- **zk-SNARK Proof Verification:** `verifier.verifyProof(...)` calls a separate Verifier smart contract (generated from the Circom circuit) to verify the validity of the zero-knowledge proof. This confirms that the user knows the correct secret and that their commitment was indeed in the Merkle tree without revealing this information.
- **Mark Nullifier as Used:** `nullifierUsed[nullifierHash] = true;` records the nullifier hash as used, preventing it from being used again.
- **Send Ether to Recipient:** `recipient.call{value: DEPOSIT_AMOUNT}("");` sends the deposited amount (0.1 ETH) to the recipient address specified in the withdrawal transaction.
- **Withdrawal Event:** `emit Withdrawal(recipient, nullifierHash);` emits an event to the blockchain, recording the successful withdrawal.

## 5. Zero-Knowledge Workflow

The core of the privacy aspect of this mixer lies in the use of circom circuits.

- **Circom:** is language which allows one to define circuits which can require certain input and produce certain outputs and thus can check for satisfiablity.

Circomlib library provides circom circuits for certain hashing function which are used in this demo. This included Poseidon has. 


- **snarkjs:** Snarkjs is a JavaScript library that provides tools for working with zero-knowledge proof. However to generate the proofs, you first need to complete the Powersoftau ceremony. 

This ceremoney takes inputs from various sources; typically entropy entered by multiple user. 
It has two phases. 


Powers of Tau

```
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
```
Then, we contribute to the ceremony:
```

snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
```

Getting the contributions to the powers of tau in the file pot12_0001.ptau allows us to proceed with the Phase 2.



The phase 2 is circuit-specific.
```
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup multiplier2.r1cs pot12_final.ptau multiplier2_0000.zkey
```
Contribute to the phase 2 of the ceremony:
```
snarkjs zkey contribute multiplier2_0000.zkey multiplier2_0001.zkey --name="1st Contributor Name" -v
```
Export the verification key:

```
snarkjs zkey export verificationkey multiplier2_0001.zkey verification_key.json
```

The Circom circuit `mixer.circom` defines the specific mathematical constraints that the zk-SNARK proof must satisfy. The `Verifier.sol` contract, generated from this circuit, contains the logic that the Mixer smart contract uses to verify these proofs.

## 6. Conclusion

This documentation provides a comprehensive overview of the cryptocurrency mixer POC. The deposit workflow allowing users to contribute Ether anonymously. The withdrawal workflow, the client-side capable of fetching commitments and generating Merkle proofs. The final steps of zk-SNARK proof generation and submission for withdrawal are the next stages of development. This project demonstrates the fundamental principles of using zk-SNARKs and Merkle trees to build privacy-enhancing tools on the blockchain.
