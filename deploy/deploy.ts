import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedZamaPoll = await deploy("ZamaPoll", {
    from: deployer,
    log: true,
  });

  console.log(`ZamaPoll contract: `, deployedZamaPoll.address);
};
export default func;
func.id = "deploy_zamaPoll"; // id required to prevent reexecution
func.tags = ["ZamaPoll"];
