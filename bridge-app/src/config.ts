export type SuiChain = `${string}:${string}`;

export interface Config {
  ethereumContract: string;
  suiPackageId: string;
  suiAdminCapId: string;
  suiTreasuryCapId: string;
  suiNetwork: SuiChain;
}

const getEnvVar = (key: string, fallback: string): string => {
  return import.meta.env[key] || fallback;
};

export const CONFIG: Config = {
  ethereumContract: getEnvVar('VITE_ETHEREUM_CONTRACT', ''),
  suiPackageId: getEnvVar('VITE_SUI_PACKAGE_ID', ''),
  suiAdminCapId: getEnvVar('VITE_SUI_ADMIN_CAP_ID', ''),
  suiTreasuryCapId: getEnvVar('VITE_SUI_TREASURY_CAP_ID', ''),
  suiNetwork: getEnvVar('VITE_SUI_NETWORK', '') as SuiChain,
};

export const ETH_CONTRACT_ABI = [
  'function owner() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function mint(address, uint256)',
  'function burn(address, uint256)',
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];
