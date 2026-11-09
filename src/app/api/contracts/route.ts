import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

/** Source files exposed to the in-app contract viewer. */
const FILES = [
  { key: "registry", label: "PortaGraphRegistry.sol", path: "contracts/PortaGraphRegistry.sol" },
  { key: "campaign", label: "CampaignManager.sol", path: "contracts/CampaignManager.sol" },
  { key: "holding", label: "SafetyHolding.sol", path: "contracts/SafetyHolding.sol" },
  { key: "registry-test", label: "Registry.t.sol", path: "contracts/test/Registry.t.sol" },
  { key: "campaign-test", label: "CampaignManager.t.sol", path: "contracts/test/CampaignManager.t.sol" },
];

/** GET /api/contracts — Solidity sources for the viewer, read from the repo. */
export async function GET() {
  const root = process.cwd();
  const files = await Promise.all(
    FILES.map(async (f) => {
      try {
        const code = await readFile(path.join(root, f.path), "utf8");
        return { ...f, code, loc: code.split("\n").length };
      } catch {
        return { ...f, code: `// ${f.path} not found in build`, loc: 1 };
      }
    })
  );

  return NextResponse.json({
    files,
    deployment: {
      network: "Base Sepolia (demo targets)",
      chainId: 84532,
      contracts: [
        { name: "PortaGraphRegistry", address: "0x7fa9…1496", note: "SBT matrix root — immutable" },
        { name: "CampaignManager", address: "0x9d3c…84a1", note: "Upline compression + fee splits" },
        { name: "SafetyHolding", address: "0xe1f4…0c77", note: "72h grace-period escrow" },
        { name: "EntryPoint (ERC-4337)", address: "0x5ff1…37e9", note: "Bundler + paymaster compatible" },
      ],
    },
  });
}
