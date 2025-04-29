const express = require('express');
const { MerkleTree } = require('merkletreejs');
const { poseidon } = require('circomlibjs');
const app = express();

const leaves = [Buffer.alloc(32)]; // Initialize with zero leaf
const tree = new MerkleTree(leaves, poseidon, { hashLeaves: false });

app.use(express.json());

// Add a new commitment
app.post('/deposit', (req, res) => {
    const { commitment } = req.body;
    leaves.push(Buffer.from(commitment.slice(2), 'hex'));
    tree = new MerkleTree(leaves, poseidon, { hashLeaves: false });
    res.json({ leafIndex: leaves.length - 1 });
});

// Get Merkle proof for a commitment
app.get('/merkle-proof', (req, res) => {
    const { commitment } = req.query;
    const leaf = Buffer.from(commitment.slice(2), 'hex');
    const leafIndex = leaves.findIndex(l => l.equals(leaf));
    if (leafIndex === -1) return res.status(404).json({ error: 'Commitment not found' });
    
    const proof = tree.getProof(leafIndex);
    const pathElements = proof.map(p => '0x' + p.data.toString('hex'));
    const pathIndices = tree.getProofPath(leafIndex).map(p => p ? 1 : 0);
    const root = '0x' + tree.getRoot().toString('hex');
    
    res.json({ root, pathElements, pathIndices, leafIndex });
});

app.listen(3000, () => console.log('Server running on port 3000'));