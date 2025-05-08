# Mixer: A zk-SNARK-Based Ethereum Mixer

Mixer is a privacy-focused Ethereum mixer that leverages zero-knowledge proofs (zk-SNARKs) and Merkle trees to enable anonymous deposits and withdrawals of fixed-denomination ETH.

## Features

- Fixed 0.1 ETH deposits and withdrawals
- zk-SNARK proofs for private withdrawals
- Merkle tree-based commitment tracking
- Poseidon hash for efficient on-chain hashing
- Groth16 verifier integration


## Installation Guide

### 1. Clone the Repository

```bash
git clone https://github.com/jchauhn/Mixer.git
cd Mixer
```

The directory is framed like a hardhat repo (because it is)

### 2. Install Dependencies

Please have `npm` installed before proceeding.

```bash
npm install requirements
```

This will download all the requisite packages required for this proof.

## Usage

```bash
npx hardhat test
```

This repo primarily uses the Hardhat's local in-process ETH blockchain for the deploying of all contracts. This is was  design choice to streamline the design proces for the Proof-of-Concept so that we could focus on the ZK Proof.

The ZK Proof is generated and verifier using the `circomlib` and `circomlibjs` npm libraries. For convenience, generate\_witness.js, mixer.wasm, witness\_calculator.js and is already created and incorporated in the test case 

To manually compile the circuit using `mixer.circom` and `merkleTree.circom`, refer to the docs.circom.io. 

### Deposit

```js
const {commitment, secret, nullifier} = await getCommitment();
      // Sending deposit to the contract
await expect(
    mixer.connect(otherAccount).deposit(commitment, { value: ethers.parseEther("0.1") })
      )

```

The deposit value is hardcoded. The contract will only accept 0.1 ETH. This design choice was taken due to simplicity and privacy protection from a uniform money pool 

### Withdraw

```js
      const {witnessPath,nullifierHash,root} = await generateWitness(mixer,commitment, secret, nullifier, owner.address);
      const zkeyPath = "./scripts/zkey.json";
      const {solidityCalldata} = await generateProof(zkeyPath, witnessPath);
      await mixer.withdraw(nullifierHash, root, owner.address, solidityCalldata);
```

The function `mixer.withdraw` will fail if proof is incorrect or the root doesn't match
'generateProof` and `generateWitness` will create files inside the scripts folder. This is beacuse to generate the witness for the circuit, requires snarkjs

---

## Project Structure

- `circuits/`: Circom circuit files
- `contracts/`: Solidity smart contracts
- `scripts/`: Verification intermediates scripts
- `test/`: Contains `Mixer.js` which implements all the tests.
