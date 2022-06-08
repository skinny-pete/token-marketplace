require("@nomiclabs/hardhat-waffle");

module.exports = {
  solidity: "0.8.4",
  networks: {
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: [
        "c22876839be9bb295ca99f427c53dc76c1f960a4f7e428a5e4d2ed7c62feb204",
      ],
    },
  },
};
