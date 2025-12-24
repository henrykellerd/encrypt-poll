import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ==========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the ZamaPoll contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the ZamaPoll contract
 *
 *   npx hardhat --network localhost task:submit-answer --question 0 --option 1
 *   npx hardhat --network localhost task:make-results-public --question 0
 *   npx hardhat --network localhost task:decrypt-results --question 0
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ==========================================================
 *
 * 1. Deploy the ZamaPoll contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the ZamaPoll contract
 *
 *   npx hardhat --network sepolia task:submit-answer --question 0 --option 1
 *   npx hardhat --network sepolia task:make-results-public --question 0
 *   npx hardhat --network sepolia task:decrypt-results --question 0
 *
 */

task("task:address", "Prints the ZamaPoll address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const zamaPoll = await deployments.get("ZamaPoll");

  console.log("ZamaPoll address is " + zamaPoll.address);
});

task("task:submit-answer", "Submits an encrypted answer to ZamaPoll")
  .addOptionalParam("address", "Optionally specify the ZamaPoll contract address")
  .addParam("question", "Question index")
  .addParam("option", "Option index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const question = parseInt(taskArguments.question);
    const option = parseInt(taskArguments.option);

    if (!Number.isInteger(question) || !Number.isInteger(option)) {
      throw new Error("Arguments --question and --option must be integers");
    }

    await fhevm.initializeCLIApi();

    const zamaPollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZamaPoll");
    console.log(`ZamaPoll: ${zamaPollDeployment.address}`);

    const signers = await ethers.getSigners();

    const zamaPollContract = await ethers.getContractAt("ZamaPoll", zamaPollDeployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(zamaPollDeployment.address, signers[0].address)
      .add32(option)
      .encrypt();

    const tx = await zamaPollContract
      .connect(signers[0])
      .submitAnswer(question, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`ZamaPoll submitAnswer(question=${question}, option=${option}) succeeded!`);
  });

task("task:make-results-public", "Makes question results publicly decryptable")
  .addOptionalParam("address", "Optionally specify the ZamaPoll contract address")
  .addParam("question", "Question index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const question = parseInt(taskArguments.question);
    if (!Number.isInteger(question)) {
      throw new Error("Argument --question must be an integer");
    }

    const zamaPollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZamaPoll");
    console.log(`ZamaPoll: ${zamaPollDeployment.address}`);

    const signers = await ethers.getSigners();
    const zamaPollContract = await ethers.getContractAt("ZamaPoll", zamaPollDeployment.address);

    const tx = await zamaPollContract.connect(signers[0]).makeResultsPublic(question);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`ZamaPoll makeResultsPublic(question=${question}) succeeded!`);
  });

task("task:decrypt-results", "Decrypts public results for a question")
  .addOptionalParam("address", "Optionally specify the ZamaPoll contract address")
  .addParam("question", "Question index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const question = parseInt(taskArguments.question);
    if (!Number.isInteger(question)) {
      throw new Error("Argument --question must be an integer");
    }

    await fhevm.initializeCLIApi();

    const zamaPollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("ZamaPoll");
    console.log(`ZamaPoll: ${zamaPollDeployment.address}`);

    const signers = await ethers.getSigners();
    const zamaPollContract = await ethers.getContractAt("ZamaPoll", zamaPollDeployment.address);

    const encryptedCounts = await zamaPollContract.getEncryptedCounts(question);
    const optionCount = await zamaPollContract.getOptionCount(question);

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
        zamaPollDeployment.address,
        signers[0],
      );
      clearCounts.push(Number(clear));
    }

    console.log(`Clear counts for question ${question}: [${clearCounts.join(", ")}]`);
  });
