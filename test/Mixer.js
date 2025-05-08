const { getCurveFromName, Scalar }  = require("ffjavascript");
// const buildBabyJub = require("../node_modules/circomlibjs/src/babyjub.js");
// const buildPedersenHash = require("../node_modules/circomlibjs/src/pedersen_hash.js");

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
// const bigInt = require('big-integer');
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect,anyValue } = require("chai");
const {execSync} = require('child_process');
// const { createCode } = require("../node_modules/circomlibjs/src/mimcsponge_gencontract.js")
// const { buildBabyJub } = require("circomlibjs")
const { buildPedersenHash } = require("circomlibjs");
const { buildPoseidon } = require("circomlibjs");

const {createCode, generateABI} =  require("../node_modules/circomlibjs/src/poseidon_gencontract.js");

const snarkjs = require('snarkjs')
const merkletree = require('merkletreejs')

const { ethers } = require("hardhat");

// const { ethers: ethers2 } = require("ethers");
// const circomlibjs = require("circomlibjs");

const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))

// Helper function to generate random bytes less than field size
// async function generateRandomFieldElement() {
//     // Generate a random BigInt between 0 and FIELD_SIZE - 1
//     const randomBytes = Buffer.from(crypto.getRandomValues(new Uint8Array(31)));
//     // const randomValue = randomBytes.readInt32BE(0, 31);
    
//     return randomBytes;

// }






async function generateRandomFieldElement() {
  let randomBytes
  let rand;
  do {
      randomBytes = crypto.getRandomValues(new Uint8Array(32));
      rand = BigInt('0x' + Buffer.from(randomBytes).toString('hex'));
  } while (rand >= FIELD_SIZE); // reject if out of range

  // rand = rand / 10n**5n ;
  // rand = rand.toString(16);
  // rand = Buffer.from(rand, 'hex');
  // return rand;
  return randomBytes;
}

function convertToBigInt(randomBytes) {
  return BigInt('0x' + Buffer.from(randomBytes).toString('hex'));
}

function convertToBytes(bigInt) {
  if (bigInt === 0n) {
    return new Uint8Array([0]);
  } 

  return Uint8Array.from(Buffer.from(bigInt.toString(16).padStart(64, '0'), 'hex'));
}

function uint8ArrayToHex(uint8Array) {
  return '0x'+Array.from(uint8Array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function checkWithinField(randomBytes) {
  if (randomBytes.length != 32) {
    return randomBytes>=FIELD_SIZE?false:true;
  }
  const rand = convertToBigInt(randomBytes);
  if (rand >= FIELD_SIZE) {
    return false;
  }
  return true;
}




async function getCommitment() {
  const poseidon = await buildPoseidon();

  const secret = convertToBigInt(await generateRandomFieldElement());
  const nullifier = convertToBigInt(await generateRandomFieldElement());
  const commitment = poseidon([secret, nullifier]);
  const commitmentObject_bigint = poseidon.F.toObject(commitment);

  // console.log("commitmentObject_bigint", commitmentObject_bigint);
  
  const commitmentObject_bytes = convertToBytes(commitmentObject_bigint);





  


  if (!checkWithinField(secret)) {
    throw new Error("Secret is out of field");
  }
  if (!checkWithinField(nullifier)) {
    throw new Error("Nullifier is out of field");
  }
  if (!checkWithinField(commitmentObject_bigint)) {
    throw new Error("Commitment is out of field");
  }

  // console.log("commitmentObject BigINT", convertToBigInt(commitmentObject));




  // console.log("commitment", commitment);
  // console.log("commitment.toString()", Buffer.from(commitment.toString(16)), Buffer.from(commitment.toString(16)).length);
  // console.log("secret", secret );
  // console.log("nullifier", nullifier);

  // const testcase = BigInt('0x' + commitment.toString('hex'));

  // console.log("testcase", testcase);

  // const commitment_Hex = padHex(commitment.toString(16));
  // const secret_Hex = padHex(secret.toString());
  // const nullifier_Hex = padHex(nullifier.toString());

  // console.log("commitment_Hex", commitment_Hex);
  // console.log("secret_Hex", secret_Hex);
  // console.log("nullifier_Hex", nullifier_Hex);
  return {commitment: commitmentObject_bigint,secret: secret,nullifier: nullifier};
  // return {commitment: commitment_Hex,secret: secret_Hex,nullifier: nullifier_Hex};
}


describe("Mixer", function () {

  async function deployContract(deployer) {
    // const [deployer] = await ethers.getSigners();


    const C2Code = createCode(2);
    const C2 = new ethers.ContractFactory(generateABI(2),C2Code,deployer);
    const c2 = await C2.deploy();
    const c2Address = await c2.getAddress();
    console.log("c2Address", c2Address);

    // const tx = {
    //   data: bytecode,
    //   gasLimit: 3000000, // Adjust gas limit as needed
    // };
  
    // const txResponse = await deployer.sendTransaction(tx);
    // const txReceipt = await txResponse.wait();
  
    // const contractAddress = txReceipt.contractAddress;
    // console.log("Contract deployed at:", contractAddress);
  
    return c2Address;
  }

  
  async function deployMixerFixture() {
    // Deploy a mock hasher and verifier for testing
    // const bytecode = createCode("mimcsponge", 220);
    // console.log("bytecode", bytecode);
    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    const verifierAddress = await verifier.getAddress();

    const [owner, otherAccount, deployer] = await ethers.getSigners();

    // const verifierAddress = await deployContract(bytecode); // TODO: Create verifier contract using mixer.circom
    const poseidonAddress = await deployContract(deployer);



    // const MockVerifier = await ethers.getContractFactory("MockVerifier");
    // const verifier = await MockVerifier.deploy();

    

    // Deploy Mixer with 20 levels, mock hasher, and mock verifier
    const Mixer = await ethers.getContractFactory("Mixer");
    const mixer = await Mixer.deploy(10, verifierAddress, poseidonAddress);

    return { mixer, owner, otherAccount, verifierAddress };
  }


async function generateProof(zkeyPath, witnessPath) {

  // const {proof,publicSignals} = await snarkjs.groth16.prove(zkeyPath, witnessPath);
  // fs.writeFileSync('proof.json', JSON.stringify(proof));
  // fs.writeFileSync('publicSignals.json', JSON.stringify(publicSignals));
  execSync(`snarkjs groth16 prove ./scripts/mixer_0001.zkey ./scripts/witness.wtns ./scripts/proof.json ./scripts/public.json`);
  const result = execSync(`snarkjs zkey export soliditycalldata ./scripts/public.json ./scripts/proof.json`,{encoding: 'utf-8'});
  // console.log("---result", result,result.length);

  const matches = result.match(/"([^"]+)"/g);
  const solidityCalldata = matches.map(match => match.replace(/"/g, ''));

  // const proof = JSON.parse(fs.readFileSync('./scripts/proof.json', 'utf8'));
  // const publicSignals = JSON.parse(fs.readFileSync('./scripts/public.json', 'utf8'));

  // const solidityCalldata = [
  //   proof.pi_a[0],
  //   proof.pi_a[1],
  //   proof.pi_b[0][0],
  //   proof.pi_b[0][1],
  //   proof.pi_b[1][0],
  //   proof.pi_b[1][1],
  //   proof.pi_c[0],
  //   proof.pi_c[1],
  //   publicSignals[0],
  //   publicSignals[1],
  //   publicSignals[2]
  // ];

  // console.log("solidityCalldata", solidityCalldata);
  // console.log("proof", proof);
  // console.log("publicSignals", publicSignals);
  

  // const solidityCalldata = JSON.parse(result);

  console.log("Wrote files proof.json and publicSignals.json");

  // const proof = JSON.parse(fs.readFileSync('./scripts/proof.json', 'utf8'));
  // const publicSignals = JSON.parse(fs.readFileSync('./scripts/public.json', 'utf8'));
  return {solidityCalldata};
}

async function generateWitness(mixer,commitment, secret, nullifier,recipient) {
  // const pedersenHash = await buildPedersenHash();
  const poseidon = await buildPoseidon();

  // console.log("secret", typeof secret, secret);
  // console.log("nullifier", typeof nullifier, nullifier);

  // console.log("- commitment", commitment);
  // console.log("- commitment_hex", uint8ArrayToHex(commitment));
  // console.log("- commitment_hex_bigint", BigInt(uint8ArrayToHex(commitment)));
  // // console.log("- commitment_bigint_created_now", convertToBigInt(uint8ArrayToHex(commitment)));
  // console.log("c- ommitment_bigint", commitment_bigint);
  // console.log("c- reverseHex", BigInt("0xf6c1bea0c2678c1b116d1066e61f996def98be92adcabde92b8827f4b4fa7803"));
  // console.log("c- reverseHexB", BigInt("0x1f04ef20dee48d39984d8eabe768a70eafa6310ad20849d4573c3c40c2ad1e30"));
  // console.log("commitment type", typeof commitment);

  // const tempo = BigInt("9121348531615682035153747606537940915906591834718539357123474327386867173168");
  // const tempo2 = BigInt("14030416097908897320437553787826300082392928432242046897689557706485311282736");
  // const tempoHash = poseidon.F.toObject(poseidon([tempo,tempo2]));
  // const tempoHash2 = poseidon.F.toObject(poseidon([tempo2,tempo]));
  // console.log("tempo",tempo);
  // console.log("tempo2",tempo2);
  // console.log("tempoHash", tempoHash);
  // console.log("tempoHash2", tempoHash2);

  const nullifierHash = poseidon.F.toObject(poseidon([nullifier]));
  // const nullifierHash = convertToBytes(nullifierHash_bigint);
  // console.log("- nullifierHash_bigint", nullifierHash_bigint);
  // console.log("- nullifierHash_bigint.toString()", nullifierHash_bigint.toString());
  // console.log("nullifierHash", nullifierHash);
  // console.log("nullifierHash2", uint8ArrayToHex(nullifierHash));

  //verify the commitment
  // if (commitmentHex !== commitment) {
  //   throw new Error("Invalid commitment");
  // }

  //generate the proof
  //Fetch all commitments from the contract
  const commitments = await mixer.getAllCommitments();
  const defaultCommitment = await mixer.getDefaultCommitment();
  const level = Number(await mixer.getLevel());

  const leaves = [];
  // console.log("commitments length", commitments.length);

  for (let i = 0; i < commitments.length; i++) {
    // console.log("- fetched commitments[i]", commitments[i]);
    leaves.push(commitments[i]);
    // console.log("leaves[i]", leaves[i]);
  }


  // console.log("level", level);
  for (let i = 0; i < 2**level - commitments.length; i++) { 
    leaves.push(defaultCommitment);
    // if (i == 0) {
    //   console.log("leaves[i]", leaves[commitments.length+i]);
    // }
  }
  // console.log("leaves", leaves);
  // const tree = new merkletree.MerkleTree(leaves, poseidon, { sortPairs: false });
  
  // console.log("Generatedtree\n", tree.toString()); // might not need to sort pairs
  // const root = tree.getRoot();//tree.getHexRoot();

  // console.log("leaves", leaves);
  const {root, proofPath} = await generateMerkleProof(leaves, commitment);
  // console.log("root", root);
  // console.log("proofPath", proofPath);
  


  //sanity check 
  
  const contractRoot = await mixer.getMerkleRoot();
  // console.log("contractRoot", contractRoot);
  // console.log("root:", root,"\ncontractRoot:", contractRoot);


  //getting index of the commitment
  const index = commitments.indexOf(commitment);
  // console.log("index:", index);
// tree.getHex
  //building merkle path
  // const path = tree.getProof(commitment);
  // console.log("path:", path);
  const pathHex = [];
  const pathIndices = [];



  for (let i = 0; i < proofPath.length; i++) {
    // pathHex.push(BigInt(path[i]['data']));
    pathHex.push(proofPath[i]['data'].toString());
    pathIndices.push(proofPath[i]['position']=="left"?"1":"0"); // Convention needs to match merkleTree.circom
  }
  console.log("pathHex:", pathHex);
  console.log("pathIndices:", pathIndices);
  // // console.log("root:", root));
  // console.log("root_buffer :",  root);
  // console.log("root_buffer_hex:", uint8ArrayToHex(root));
  // console.log("root_buffer_bigint:", convertToBigInt(root));
  // console.log("root_buffer_bigint2:", BigInt(uint8ArrayToHex(root)));


  const witnessInput = { "root":root.toString(),
     "nullifierHash":nullifierHash.toString(), 
     "recipient":recipient,
      "secret":secret.toString(),
       "nullifier":nullifier.toString(), 
       "pathElements":pathHex, 
       "pathIndices":pathIndices 
      } 
      // TODO: array ["0","1","0"] or ["1","0","1"] according to the length of the tree
      // "0" or "1" according to the left/right of the commitment (trial and error to figure which is which)


    // Send the proof to the contract
    // Call during withdraw. Send to the withdraw function of the contract
  
  const inputJson = JSON.stringify(witnessInput, null, 0);
  // console.log("inputJson", inputJson);
  const inputJsonPath = './scripts/input.json';
  // console.log("inputJsonPath", inputJsonPath);
  fs.writeFileSync(inputJsonPath, inputJson);

  // Generate the witness
  execSync(`node ./scripts/generate_witness.js ./scripts/mixer.wasm ./scripts/input.json ./scripts/witness.wtns`);
  //const witness = JSON.parse(fs.readFileSync('witness.json', 'utf8'));
  console.log("Witness generated at", path.join(__dirname, 'scripts','witness.wtns'));


  return {witnessPath: "./scripts/witness.wtns",nullifierHash:nullifierHash,root:root};
}

async function generateMerkleProof(allLeaves, targetLeaf) {
  const poseidon = await buildPoseidon();

  // Define zeros values exactly matching the Solidity contract
  const zeros = [
    BigInt('0x256a6135777eee2fd26f54b8b7037a25439d5235caee224154186d2b8a52e31d'),
    BigInt('0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c'),
    BigInt('0x1151949895e82ab19924de92c40a3d6f7bcb60d92b00504b8199613683f0c200'),
    BigInt('0x20121ee811489ff8d61f09fb89e313f14959a0f28bb428a20dba6b0b068b3bdb'),
    BigInt('0x0a89ca6ffa14cc462cfedb842c30ed221a50a3d6bf022a6a57dc82ab24c157c9'),
    BigInt('0x24ca05c2b5cd42e890d6be94c68d0689f4f21c9cec9c0f13fe41d566dfb54959'),
    BigInt('0x1ccb97c932565a92c60156bdba2d08f3bf1377464e025cee765679e604a7315c'),
    BigInt('0x19156fbd7d1a8bf5cba8909367de1b624534ebab4f0f79e003bccdd1b182bdb4'),
    BigInt('0x261af8c1f0912e465744641409f622d466c3920ac6e5ff37e36604cb11dfff80'),
    BigInt('0x0058459724ff6ca5a1652fcbc3e82b93895cf08e975b19beab3f54c217d1c007'),
    BigInt('0x1f04ef20dee48d39984d8eabe768a70eafa6310ad20849d4573c3c40c2ad1e30'),
    BigInt('0x1bea3dec5dab51567ce7e200a30f7ba6d4276aeaa53e2686f962a46c66d511e5'),
    BigInt('0x0ee0f941e2da4b9e31c3ca97a40d8fa9ce68d97c084177071b3cb46cd3372f0f'),
    BigInt('0x1ca9503e8935884501bbaf20be14eb4c46b89772c97b96e3b2ebf3a36a948bbd'),
    BigInt('0x133a80e30697cd55d8f7d4b0965b7be24057ba5dc3da898ee2187232446cb108'),
    BigInt('0x13e6d8fc88839ed76e182c2a779af5b2c0da9dd18c90427a644f7e148a6253b6'),
    BigInt('0x1eb16b057a477f4bc8f572ea6bee39561098f78f15bfb3699dcbb7bd8db61854'),
    BigInt('0x0da2cb16a1ceaabf1c16b838f7a9e3f2a3a3088d9e0a6debaa748114620696ea'),
    BigInt('0x24a3b3d822420b14b5d8cb6c28a574f01e98ea9e940551d2ebd75cee12649f9d'),
    BigInt('0x198622acbd783d1b0d9064105b1fc8e4d8889de95c4c519b3f635809fe6afc05'),
    BigInt('0x29d7ed391256ccc3ea596c86e933b89ff339d25ea8ddced975ae2fe30b5296d4'),
    BigInt('0x19be59f2f0413ce78c0c3703a3a5451b1d7f39629fa33abd11548a76065b2967'),
    BigInt('0x1ff3f61797e538b70e619310d33f2a063e7eb59104e112e95738da1254dc3453'),
    BigInt('0x10c16ae9959cf8358980d9dd9616e48228737310a10e2b6b731c1a548f036c48'),
    BigInt('0x0ba433a63174a90ac20992e75e3095496812b652685b5e1a2eae0b1bf4e8fcd1'),
    BigInt('0x019ddb9df2bc98d987d0dfeca9d2b643deafab8f7036562e627c3667266a044c'),
    BigInt('0x2d3c88b23175c5a5565db928414c66d1912b11acf974b2e644caaac04739ce99'),
    BigInt('0x2eab55f6ae4e66e32c5189eed5c470840863445760f5ed7e7b69b2a62600f354'),
    BigInt('0x002df37a2242621802383cf952bf4dd1f32e05433beeb1fd41031fb7eace979d'),
    BigInt('0x104aeb41435db66c3e62feccc1d6f5d98d0a0ed75d1374db457cf462e3a1f427'),
    BigInt('0x1f3c6fd858e9a7d4b0d1f38e256a09d81d5a5e3c963987e2d4b814cfab7c6ebb'),
    BigInt('0x2c7a07d20dff79d01fecedc1134284a8d08436606c93693b67e333f671bf69cc')
  ];

  // Convert all leaves to BigInt
  const leaves = allLeaves.map(leaf => 
    typeof leaf === 'string' ? BigInt(leaf) : BigInt(leaf)
  );

  // Convert target leaf to BigInt
  const target = typeof targetLeaf === 'string' ? BigInt(targetLeaf) : BigInt(targetLeaf);

  // Find the index of the target leaf
  const leafIndex = leaves.findIndex(leaf => leaf === target);
  if (leafIndex === -1) {
    throw new Error("Target leaf not found in the tree");
  }

  // Initialize the proof path and current level
  const proofPath = [];
  let currentLevel = [...leaves];
  let currentIndex = leafIndex;
  let level = 0; // Track the current level for zeros

  // Build the Merkle tree and collect proof path
  while (currentLevel.length > 1) {
    const nextLevel = [];

    // Process pairs of nodes
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // Use zeros[level] for unpaired nodes instead of BigInt(0)
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : zeros[level];

      // Compute parent hash using Poseidon
      const parent = poseidon.F.toObject(poseidon([left, right]));
      nextLevel.push(parent);

      // If the current pair contains the target leaf, add sibling to proof path
      if (i === (currentIndex - (currentIndex % 2))) {
        const isLeft = currentIndex % 2 === 0;
        proofPath.push({
          position: isLeft ? 'right' : 'left',
          data: isLeft ? right : left
        });
      }
    }

    // Update current level, index, and level for the next iteration
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
    level++; // Increment level to use the next zeros value
  }

  // The root is the only node left in the final level
  const root = currentLevel[0];

  return {
    root,
    proofPath
  };
}

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const { mixer } = await loadFixture(deployMixerFixture);
      expect(await mixer.DEPOSIT_AMOUNT()).to.equal(ethers.parseEther("0.1"));
    });
  });

  describe("deposit", function () {
    it("Should accept a deposit and emit Deposit event", async function () {
      const { mixer, otherAccount } = await loadFixture(deployMixerFixture);
      
      // Initialize babyJub
      // const poseidon = await circomlibjs.buildPoseidon();
      
      // const babyJub = await buildBabyJub();
      const {commitment, secret, nullifier} = await getCommitment();
      // console.log("commitment\n", commitment);
      // console.log("secret\n", secret);
      // console.log("nullifier\n", nullifier);
      // console.log("uint8ArrayToHex(commitment)", uint8ArrayToHex(commitment));
    
      
      
      // Generate random secret and nullifier
      // console.log("#deposit commitment", commitment);
      

      await expect(
        // the commitment is a uint8Array. contract stores commitmentas a hex in bytes32[] public commitments;
        mixer.connect(otherAccount).deposit(commitment, { value: ethers.parseEther("0.1") }) 
      )
        .to.emit(mixer, "Deposit")
        .withArgs(commitment, 0, (timestamp) => {
          expect(timestamp).to.be.a("bigint");
          return true;
        });

      expect(await mixer.getCommitmentCount()).to.equal(1);
      const commitments = await mixer.getAllCommitments();
      // console.log("commitments[0]", commitments[0]);
      // console.log("commitment", commitment);
      expect(commitments[0]).to.equal(commitment); // The contract stores commitments as uint256
    });

    it("Should revert if deposit amount is incorrect", async function () {
      const { mixer, otherAccount } = await loadFixture(deployMixerFixture);
      const {commitment, secret, nullifier} = await getCommitment();

      await expect(
        mixer.connect(otherAccount).deposit(commitment, { value: ethers.parseEther("0.2") })
      ).to.be.revertedWith("Incorrect deposit amount");
    });
  });

  describe("getCommitmentCount", function () {
    it("Should return the correct number of commitments", async function () {
      const { mixer, otherAccount } = await loadFixture(deployMixerFixture);
      const {commitment, secret, nullifier} = await getCommitment();
      await mixer.connect(otherAccount).deposit(commitment, { value: ethers.parseEther("0.1") });
      expect(await mixer.getCommitmentCount()).to.equal(1);
    });
  });

  describe("getAllCommitments", function () {
    it("Should return all commitments", async function () {
      const { mixer, otherAccount } = await loadFixture(deployMixerFixture);
      const {commitment: commitment1, secret, nullifier} = await getCommitment();
      const {commitment: commitment2, secret: secret2, nullifier: nullifier2} = await getCommitment();
      await mixer.connect(otherAccount).deposit(commitment1, { value: ethers.parseEther("0.1") });
      await mixer.connect(otherAccount).deposit(commitment2, { value: ethers.parseEther("0.1") });
      const commitments = await mixer.getAllCommitments();
      expect(commitments[0]).to.equal(commitment1);
      expect(commitments[1]).to.equal(commitment2);
    });
  });

  describe("getMerkleRoot", function () {
    it("Should return the current Merkle root", async function () {
      const { mixer } = await loadFixture(deployMixerFixture);


      const root = await mixer.getMerkleRoot();
      // console.log("root", root);
      expect(root).to.be.a("bigint");
    });
  });

  describe("withdraw", function () {
    it("Should revert if nullifier already used or root is invalid", async function () {
      const { mixer, owner, otherAccount } = await loadFixture(deployMixerFixture);

      // First Deposit
      

      // Second Deposit
      // Loop deposits 27 times
      for (let i = 0; i < 27; i++) {
        const {commitment: commitment2, secret: secret2, nullifier: nullifier2} = await getCommitment();
        // Sending deposit to the contract
        await expect(
          mixer.connect(otherAccount).deposit(commitment2, { value: ethers.parseEther("0.1") })
        )
      }

      const {commitment, secret, nullifier} = await getCommitment();
      // Sending deposit to the contract
      await expect(
        mixer.connect(otherAccount).deposit(commitment, { value: ethers.parseEther("0.1") })
      )


      // Initiating withdraw

      // Generating witness for the first deposit
      const {witnessPath,nullifierHash,root} = await generateWitness(mixer,commitment, secret, nullifier, owner.address);
      // const {witnessPath: witnessPath2,nullifierHash: nullifierHash2} = await generateWitness(mixer,commitment2, secret2, nullifier2, owner.address);
      // const witnessPath = 'witness.wtns';
      // console.log("witnessPath", witnessPath);
      const zkeyPath = "./scripts/zkey.json";

      // Sending withdraw to the contract
      // Fix the proof structure in this call according to the Mixer.sol withdraw function.
      const root_merkle = await mixer.getMerkleRoot();
      // mixer.connect(owner).withdraw(nullifierHash, root, owner.address, proof);
      // console.log("root", root);
      const {solidityCalldata} = await generateProof(zkeyPath, witnessPath);
    
      // console.log("root", root);
      // console.log("root_merkle", root_merkle);
      // console.log("owner.address", owner.address);

     

    
      // // Mark nullifier as used
      // await mixer.nullifierUsed(nullifierHash);
      // await expect(
      //   mixer.withdraw(nullifierHash, root, owner.address, solidityCalldata)
      // ).to.be.reverted; // Should revert due to invalid root or nullifier
  
      await mixer.withdraw(nullifierHash, root_merkle, owner.address, solidityCalldata);


    });
  });
});
