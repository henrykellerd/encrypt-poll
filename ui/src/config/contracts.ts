// Replace with the deployed ZamaPoll address from deployments/sepolia.
export const CONTRACT_ADDRESS = '0x5Cb1cb45f04ef0350Bae8eF2EDA4A551Fe8b6D34' as const;

// ABI copied from deployments/sepolia after compiling and deploying ZamaPoll.
export const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "AlreadyAnswered",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidQuestion",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ResultsAlreadyPublic",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZamaProtocolUnsupported",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "respondent",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "AnswerSubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "requester",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "ResultsMadePublic",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "confidentialProtocolId",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "getEncryptedCounts",
    "outputs": [
      {
        "internalType": "euint32[4]",
        "name": "",
        "type": "bytes32[4]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "getOptionCount",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getQuestionCount",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "hasAnswered",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "isQuestionPublic",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      }
    ],
    "name": "makeResultsPublic",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "questionId",
        "type": "uint8"
      },
      {
        "internalType": "externalEuint32",
        "name": "choice",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "submitAnswer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
