import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { ZamaPoll } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("ZamaPollSepolia", function () {
  let signers: Signers;
  let zamaPollContract: ZamaPoll;
  let zamaPollContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const zamaPollDeployment = await deployments.get("ZamaPoll");
      zamaPollContractAddress = zamaPollDeployment.address;
      zamaPollContract = await ethers.getContractAt("ZamaPoll", zamaPollDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("submits an answer and decrypts public results", async function () {
    steps = 10;

    this.timeout(4 * 40000);

    const questionId = 0;
    const optionIndex = 1;

    progress("Encrypting option index...");
    const encryptedChoice = await fhevm
      .createEncryptedInput(zamaPollContractAddress, signers.alice.address)
      .add32(optionIndex)
      .encrypt();

    progress(
      `Call submitAnswer(${questionId}) ZamaPoll=${zamaPollContractAddress} handle=${ethers.hexlify(encryptedChoice.handles[0])} signer=${signers.alice.address}...`,
    );
    let tx = await zamaPollContract
      .connect(signers.alice)
      .submitAnswer(questionId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    await tx.wait();

    progress(`Call makeResultsPublic(${questionId})...`);
    tx = await zamaPollContract.connect(signers.alice).makeResultsPublic(questionId);
    await tx.wait();

    progress(`Call getEncryptedCounts(${questionId})...`);
    const encryptedCounts = await zamaPollContract.getEncryptedCounts(questionId);
    const optionCount = await zamaPollContract.getOptionCount(questionId);

    progress(`Decrypting counts...`);
    const clearCounts: number[] = [];
    for (let i = 0; i < optionCount; i++) {
      const handle = encryptedCounts[i];
      if (handle === ethers.ZeroHash) {
        clearCounts.push(0);
        continue;
      }
      const clear = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        handle,
        zamaPollContractAddress,
        signers.alice,
      );
      clearCounts.push(Number(clear));
    }

    progress(`Clear counts: ${clearCounts.join(", ")}`);
    expect(clearCounts[optionIndex]).to.eq(1);
  });
});
