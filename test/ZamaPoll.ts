import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ZamaPoll, ZamaPoll__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ZamaPoll")) as ZamaPoll__factory;
  const zamaPollContract = (await factory.deploy()) as ZamaPoll;
  const zamaPollContractAddress = await zamaPollContract.getAddress();

  return { zamaPollContract, zamaPollContractAddress };
}

describe("ZamaPoll", function () {
  let signers: Signers;
  let zamaPollContract: ZamaPoll;
  let zamaPollContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ zamaPollContract, zamaPollContractAddress } = await deployFixture());
  });

  it("encrypted counts should be uninitialized after deployment", async function () {
    const encryptedCounts = await zamaPollContract.getEncryptedCounts(0);
    for (const count of encryptedCounts) {
      expect(count).to.eq(ethers.ZeroHash);
    }
  });

  it("submits an answer and decrypts public results", async function () {
    const questionId = 1;
    const optionIndex = 2;

    const encryptedChoice = await fhevm
      .createEncryptedInput(zamaPollContractAddress, signers.alice.address)
      .add32(optionIndex)
      .encrypt();

    const tx = await zamaPollContract
      .connect(signers.alice)
      .submitAnswer(questionId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    await tx.wait();

    const publicTx = await zamaPollContract.connect(signers.alice).makeResultsPublic(questionId);
    await publicTx.wait();

    const encryptedCounts = await zamaPollContract.getEncryptedCounts(questionId);
    const optionCount = await zamaPollContract.getOptionCount(questionId);

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

    expect(clearCounts[optionIndex]).to.eq(1);
    for (let i = 0; i < optionCount; i++) {
      if (i !== optionIndex) {
        expect(clearCounts[i]).to.eq(0);
      }
    }

    const isPublic = await zamaPollContract.isQuestionPublic(questionId);
    expect(isPublic).to.eq(true);

    const answered = await zamaPollContract.hasAnswered(signers.alice.address, questionId);
    expect(answered).to.eq(true);
  });

  it("prevents answering the same question twice", async function () {
    const questionId = 0;
    const optionIndex = 1;

    const encryptedChoice = await fhevm
      .createEncryptedInput(zamaPollContractAddress, signers.alice.address)
      .add32(optionIndex)
      .encrypt();

    const tx = await zamaPollContract
      .connect(signers.alice)
      .submitAnswer(questionId, encryptedChoice.handles[0], encryptedChoice.inputProof);
    await tx.wait();

    const encryptedChoiceAgain = await fhevm
      .createEncryptedInput(zamaPollContractAddress, signers.alice.address)
      .add32(optionIndex)
      .encrypt();

    await expect(
      zamaPollContract
        .connect(signers.alice)
        .submitAnswer(questionId, encryptedChoiceAgain.handles[0], encryptedChoiceAgain.inputProof),
    ).to.be.revertedWithCustomError(zamaPollContract, "AlreadyAnswered");
  });
});
