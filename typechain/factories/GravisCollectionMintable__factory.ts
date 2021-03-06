/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";

import type { GravisCollectionMintable } from "../GravisCollectionMintable";

export class GravisCollectionMintable__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<GravisCollectionMintable> {
    return super.deploy(overrides || {}) as Promise<GravisCollectionMintable>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): GravisCollectionMintable {
    return super.attach(address) as GravisCollectionMintable;
  }
  connect(signer: Signer): GravisCollectionMintable__factory {
    return super.connect(signer) as GravisCollectionMintable__factory;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): GravisCollectionMintable {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as GravisCollectionMintable;
  }
}

const _abi = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "previousAdminRole",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "bytes32",
        name: "newAdminRole",
        type: "bytes32",
      },
    ],
    name: "RoleAdminChanged",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "RoleRevoked",
    type: "event",
  },
  {
    inputs: [],
    name: "DEFAULT_ADMIN_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MINTER_ROLE",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "getRoleAdmin",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "uint256",
        name: "index",
        type: "uint256",
      },
    ],
    name: "getRoleMember",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
    ],
    name: "getRoleMemberCount",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "grantRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "hasRole",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "renounceRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "role",
        type: "bytes32",
      },
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "revokeRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50610023600061001e610028565b61002c565b61012d565b3390565b610036828261003a565b5050565b60008281526020818152604090912061005c9183906103ad6100ad821b17901c565b1561003657610069610028565b6001600160a01b0316816001600160a01b0316837f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a45050565b60006100c2836001600160a01b0384166100cb565b90505b92915050565b60006100d78383610115565b61010d575081546001818101845560008481526020808220909301849055845484825282860190935260409020919091556100c5565b5060006100c5565b60009081526001919091016020526040902054151590565b61074f8061013c6000396000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c806391d148541161006657806391d1485414610160578063a217fddf146101a0578063ca15c873146101a8578063d5391393146101c5578063d547741f146101cd57610093565b8063248a9ca3146100985780632f2ff15d146100c757806336568abe146100f55780639010d07c14610121575b600080fd5b6100b5600480360360208110156100ae57600080fd5b50356101f9565b60408051918252519081900360200190f35b6100f3600480360360408110156100dd57600080fd5b50803590602001356001600160a01b031661020e565b005b6100f36004803603604081101561010b57600080fd5b50803590602001356001600160a01b031661027a565b6101446004803603604081101561013757600080fd5b50803590602001356102db565b604080516001600160a01b039092168252519081900360200190f35b61018c6004803603604081101561017657600080fd5b50803590602001356001600160a01b03166102fc565b604080519115158252519081900360200190f35b6100b5610314565b6100b5600480360360208110156101be57600080fd5b5035610319565b6100b5610330565b6100f3600480360360408110156101e357600080fd5b50803590602001356001600160a01b0316610354565b60009081526020819052604090206002015490565b6000828152602081905260409020600201546102319061022c6103c2565b6102fc565b61026c5760405162461bcd60e51b815260040180806020018281038252602f81526020018061068c602f913960400191505060405180910390fd5b61027682826103c6565b5050565b6102826103c2565b6001600160a01b0316816001600160a01b0316146102d15760405162461bcd60e51b815260040180806020018281038252602f8152602001806106eb602f913960400191505060405180910390fd5b610276828261042f565b60008281526020819052604081206102f39083610498565b90505b92915050565b60008281526020819052604081206102f390836104a4565b600081565b60008181526020819052604081206102f6906104b9565b7f9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a681565b6000828152602081905260409020600201546103729061022c6103c2565b6102d15760405162461bcd60e51b81526004018080602001828103825260308152602001806106bb6030913960400191505060405180910390fd5b60006102f3836001600160a01b0384166104c4565b3390565b60008281526020819052604090206103de90826103ad565b15610276576103eb6103c2565b6001600160a01b0316816001600160a01b0316837f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a45050565b6000828152602081905260409020610447908261050e565b15610276576104546103c2565b6001600160a01b0316816001600160a01b0316837ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b60405160405180910390a45050565b60006102f38383610523565b60006102f3836001600160a01b038416610587565b60006102f68261059f565b60006104d08383610587565b610506575081546001818101845560008481526020808220909301849055845484825282860190935260409020919091556102f6565b5060006102f6565b60006102f3836001600160a01b0384166105a3565b815460009082106105655760405162461bcd60e51b815260040180806020018281038252602281526020018061066a6022913960400191505060405180910390fd5b82600001828154811061057457fe5b9060005260206000200154905092915050565b60009081526001919091016020526040902054151590565b5490565b6000818152600183016020526040812054801561065f57835460001980830191908101906000908790839081106105d657fe5b90600052602060002001549050808760000184815481106105f357fe5b60009182526020808320909101929092558281526001898101909252604090209084019055865487908061062357fe5b600190038181906000526020600020016000905590558660010160008781526020019081526020016000206000905560019450505050506102f6565b60009150506102f656fe456e756d657261626c655365743a20696e646578206f7574206f6620626f756e6473416363657373436f6e74726f6c3a2073656e646572206d75737420626520616e2061646d696e20746f206772616e74416363657373436f6e74726f6c3a2073656e646572206d75737420626520616e2061646d696e20746f207265766f6b65416363657373436f6e74726f6c3a2063616e206f6e6c792072656e6f756e636520726f6c657320666f722073656c66a2646970667358221220a8df3ffd7f3fbf84211e32fdbfbb40d396c5ad85d72e954ea96a29c16a67821864736f6c634300060c0033";
