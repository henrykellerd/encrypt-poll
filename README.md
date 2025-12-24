# Zama Encrypted Poll

Zama Encrypted Poll is a privacy-first on-chain survey that uses Fully Homomorphic Encryption (FHE) on FHEVM.
Participants submit encrypted answers directly to the chain, the contract tallies encrypted counts per option,
and results can be revealed publicly only on a per-question basis when someone requests disclosure.

This repository contains:
- A Solidity smart contract that stores encrypted counts and controls per-question disclosure.
- Hardhat deploy and task scripts for local and Sepolia interaction.
- A React + Vite frontend that encrypts answers with the Zama Relayer SDK and decrypts public results.

## What This Project Does
- Presents 5 Zama-related questions, each with 2 to 4 options.
- Encrypts each answer in the browser using the Zama Relayer SDK.
- Submits encrypted answers to the `ZamaPoll` contract using Ethers for write calls.
- Updates per-option counts using encrypted arithmetic (euint32).
- Allows anyone to make results public for a single question at a time.
- Reads encrypted counts with viem and decrypts them only after the contract marks them public.

## Problems This Solves
- **Survey privacy**: Individual choices never appear in plaintext on-chain.
- **Trust reduction**: No centralized backend is required to collect or tally answers.
- **Selective disclosure**: Results can be revealed question by question instead of all at once.
- **Auditability**: The tally logic is on-chain and verifiable even though data stays encrypted.
- **Data minimization**: Only aggregated counts become public, not individual responses.

## Advantages of the Approach
- **Encrypted tallies on-chain**: Counts are computed using FHE, not off-chain scripts.
- **Per-question control**: Each question's results are independently made public.
- **Wallet-native UX**: Users submit answers with standard wallet signing flows.
- **No plaintext storage**: Encrypted counts are stored as `euint32` values.
- **Composable privacy**: The same pattern can be reused for other surveys and votes.

## Survey Content (Questions and Options)
1. **Zama Focus** - "What is Zama best known for in web3 today?"
   - Fully Homomorphic Encryption (FHE)
   - Layer-2 bridging
   - NFT marketplaces
2. **FHE Fundamentals** - "Which statement best describes FHE?"
   - It allows computation on encrypted data without decryption
   - It hides block timestamps from validators
   - It stores private keys on-chain
   - It compresses calldata for cheaper gas
3. **Network** - "Which network does this FHEVM demo target?"
   - Ethereum Sepolia
   - Polygon mainnet
   - Base Sepolia
4. **Relayer** - "What does the Relayer SDK handle for users?"
   - Ciphertext registration and proofs
   - Gas fee refunds
   - Token swaps
5. **Privacy** - "Which part of the survey stays encrypted on-chain?"
   - Each selected answer
   - Only the question text
   - The wallet address

## Architecture and Data Flow
1. **User selects an option** in the UI for a specific question.
2. **Client-side encryption**:
   - The Zama Relayer SDK creates an encrypted input.
   - The selected option index is encrypted into a ciphertext handle.
3. **Encrypted submission**:
   - The frontend calls `submitAnswer` with `questionId`, encrypted handle, and proof.
   - The contract validates the question, checks for duplicate answers, and rejects if results are already public.
4. **Encrypted tallying**:
   - The contract increments encrypted counts using FHE operations.
   - Each count is stored as an encrypted `euint32`.
5. **Selective disclosure**:
   - Anyone can call `makeResultsPublic(questionId)`.
   - The contract marks that question public and makes its encrypted counts publicly decryptable.
6. **Result reveal**:
   - The UI reads encrypted handles via viem.
   - The Relayer SDK decrypts handles that have been made publicly decryptable.

## Smart Contract Details
File: `contracts/ZamaPoll.sol`

Key behaviors:
- **Fixed survey size**: 5 questions, max 4 options each.
- **Per-address participation**: One answer per question, tracked by `_hasAnswered`.
- **Encrypted counts**: Stored in `_counts` as `euint32[MAX_OPTIONS][QUESTION_COUNT]`.
- **Public toggle**: `_isPublic` marks which questions are publicly decryptable.

Public methods:
- `getQuestionCount()`: returns 5.
- `getOptionCount(questionId)`: returns the number of options for a question.
- `hasAnswered(user, questionId)`: checks if a user already answered.
- `isQuestionPublic(questionId)`: checks if results are public.
- `getEncryptedCounts(questionId)`: returns encrypted handles for each option.
- `submitAnswer(questionId, choice, inputProof)`: submits an encrypted answer.
- `makeResultsPublic(questionId)`: makes a question's results publicly decryptable.

Events:
- `AnswerSubmitted(respondent, questionId)`
- `ResultsMadePublic(requester, questionId)`

## Tech Stack
- **Smart contracts**: Solidity, Hardhat, @fhevm/solidity
- **Encryption**: Zama FHEVM and Relayer SDK
- **Frontend**: React + Vite, custom CSS (no Tailwind)
- **Wallet + UX**: RainbowKit + wagmi
- **Reads**: viem
- **Writes**: ethers

## Project Structure
```
contracts/              # Solidity contracts
deploy/                 # Hardhat deploy scripts
tasks/                  # Hardhat CLI tasks for local and Sepolia
test/                   # Contract tests
docs/                   # Zama docs and references
ui/                     # React + Vite frontend
```

## Setup and Usage

### Prerequisites
- **Node.js**: 20+
- **npm**: any recent version

### Install Dependencies
Root (contracts + tasks):
```bash
npm install
```

Frontend:
```bash
cd ui
npm install
```

### Environment Configuration (Hardhat)
Hardhat reads environment variables from `.env`. Use a private key (no mnemonic).

Example `.env`:
```bash
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_key_optional
```

### Compile and Test
```bash
npm run compile
npm run test
```

### Local Node and Local Deployment
Start a local node:
```bash
npx hardhat node
```

Deploy locally:
```bash
npx hardhat deploy --network localhost
```

Run local tasks (examples):
```bash
npx hardhat task:submit-answer --network localhost --question 0 --option 1
npx hardhat task:make-results-public --network localhost --question 0
npx hardhat task:decrypt-results --network localhost --question 0
```

### Deploy to Sepolia
```bash
npx hardhat deploy --network sepolia
```

Confirm address:
```bash
npx hardhat task:address --network sepolia
```

### Frontend Configuration
The UI does not use environment variables. After deployment:
1. Copy the ABI from `deployments/sepolia/ZamaPoll.json`.
2. Paste it into `ui/src/config/contracts.ts` as `CONTRACT_ABI`.
3. Set `CONTRACT_ADDRESS` in `ui/src/config/contracts.ts`.

### Run the Frontend
```bash
cd ui
npm run dev
```

Build and preview:
```bash
npm run build
npm run preview
```

## Operational Notes and Behavior
- Each wallet can answer each question only once.
- Results cannot be reverted back to private once made public.
- Encrypted counts for unavailable options remain zero-handles.
- The survey is intended for Sepolia; the UI expects chain id 11155111.
- The frontend keeps all configuration in code (no local storage, no env vars).

## Security and Privacy Considerations
- **On-chain privacy**: Only encrypted counts are stored; raw answers never appear in plaintext.
- **Participation visibility**: The fact that an address answered a question is still visible.
- **Disclosure control**: Any user can make a question's results public; plan governance accordingly.
- **Client trust**: The browser handles encryption and decryption, so client integrity matters.

## Future Plan
- Add role-based or quorum-based controls for making results public.
- Support dynamic question sets and configurable option counts.
- Add analytics for response trends without compromising privacy.
- Provide multi-chain support (additional testnets and L2s).
- Improve UI accessibility and localization.
- Add indexer integrations for richer dashboards while keeping data encrypted.

## Documentation
- `docs/zama_llm.md` - Zama FHEVM contract guidance
- `docs/zama_doc_relayer.md` - Zama Relayer SDK reference

## License
BSD-3-Clause-Clear. See `LICENSE`.
