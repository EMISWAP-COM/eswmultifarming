const { expect, assert } = require("chai");
const { constants, utils, BigNumber } = require("ethers");
const { ethers, network } = require("hardhat");
const { tokens, tokensDec } = require("../utils/utils");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("Farming", function () {
    let MockLP, esw, usdt, weth, RewardPool, emiRouter, emiFactory;
    before(async () => {
        [owner, Alice, Bob, Clarc] = await ethers.getSigners();
    });

    beforeEach("Contracts created", async function () {
        const MOCKLP = await ethers.getContractFactory("MockLP");
        lpInstance = await MOCKLP.deploy();
        await lpInstance.deployed();

        const MOCKESW = await ethers.getContractFactory("MockESW");
        esw = await MOCKESW.deploy();
        await esw.deployed();

        const MOCKUSDT = await ethers.getContractFactory("MockUSDT");
        usdt = await MOCKUSDT.deploy();
        await usdt.deployed();

        const MOCKUSDC = await ethers.getContractFactory("MockUSDT");
        usdc = await MOCKUSDC.deploy();
        await usdc.deployed();

        const MOCKDAI = await ethers.getContractFactory("MockWETH");
        dai = await MOCKDAI.deploy();
        await dai.deployed();

        const MOCKWETH = await ethers.getContractFactory("MockWETH");
        weth = await MOCKWETH.deploy();
        await weth.deployed();

        const MOCKWBTC = await ethers.getContractFactory("MockWBTC");
        wbtc = await MOCKWBTC.deploy();
        await wbtc.deployed();

        const MOCKUNI = await ethers.getContractFactory("MockWETH");
        uni = await MOCKUNI.deploy();
        await uni.deployed();

        const MOCKWMATIC = await ethers.getContractFactory("MockWETH");
        wmatic = await MOCKWMATIC.deploy();
        await wmatic.deployed();

        const EMIFACTORY = await ethers.getContractFactory("EmiFactory");
        emiFactory = await EMIFACTORY.deploy();
        await emiFactory.deployed();

        const EMIROUTER = await ethers.getContractFactory("EmiRouter");
        emiRouter = await EMIROUTER.deploy(emiFactory.address, weth.address);
        await emiRouter.deployed();
        /**
         available pairs
            wbtc-weth
            wbtc-uni
            esw-weth
            weth-usdt
            wmatic-esw
            dai-usdc
          
         routes to usdt:
            wbtc-weth-usdt
            esw-weth-usdt
            uni-wbtc-weth-usdt
            wmatic-esw-weth-usdt

         no routes to usdt:
            dai-usdc
         */

        // wbtc-weth Add liquidity (100:10000)
        await wbtc.approve(emiRouter.address, tokensDec("100", 8));
        await weth.approve(emiRouter.address, tokensDec("10000", 18));
        await emiRouter.addLiquidity(
            wbtc.address,
            weth.address,
            tokensDec("100", 8),
            tokensDec("10000", 18),
            tokens("0"),
            tokens("0"),
            ZERO_ADDRESS
        );

        // wbtc-uni Add liquidity (40:100000)
        await wbtc.approve(emiRouter.address, tokensDec("40", 8));
        await uni.approve(emiRouter.address, tokensDec("100000", 18));
        await emiRouter.addLiquidity(
            wbtc.address,
            uni.address,
            tokensDec("40", 8),
            tokensDec("100000", 18),
            tokens("0"),
            tokens("0"),
            ZERO_ADDRESS
        );

        // esw-weth Add liquidity (10000:1)
        await esw.approve(emiRouter.address, tokensDec("100000000", 18));
        await weth.approve(emiRouter.address, tokensDec("10000", 18));
        await emiRouter.addLiquidity(
            esw.address,
            weth.address,
            tokensDec("100000000", 18),
            tokensDec("10000", 18),
            tokens("0"),
            tokens("0"),
            ZERO_ADDRESS
        );

        // weth-usdt Add liquidity (1:2000)
        await weth.approve(emiRouter.address, tokensDec("10000", 18));
        await usdt.approve(emiRouter.address, tokensDec("20000000", 6));
        await emiRouter.addLiquidity(
            weth.address,
            usdt.address,
            tokensDec("10000", 18),
            tokensDec("20000000", 6),
            tokens("0"),
            tokens("0"),
            ZERO_ADDRESS
        );

        // wmatic-esw Add liquidity (10000:250000)
        await wmatic.approve(emiRouter.address, tokensDec("10000", 18));
        await esw.approve(emiRouter.address, tokensDec("250000", 18));
        await emiRouter.addLiquidity(
            wmatic.address,
            esw.address,
            tokensDec("10000", 18),
            tokensDec("250000", 18),
            tokens("0"),
            tokens("0"),
            ZERO_ADDRESS
        );

        // dai-usdc Add liquidity (100000:100000)
        await dai.approve(emiRouter.address, tokensDec("100000", 18));
        await usdc.approve(emiRouter.address, tokensDec("100000", 6));
        await emiRouter.addLiquidity(
            dai.address,
            usdc.address,
            tokensDec("100000", 18),
            tokensDec("100000", 6),
            tokens("0"),
            tokens("0"),
            ZERO_ADDRESS
        );
    });

    it("run reward simple ERC-20", async function () {
        const REWARDPOOL = await ethers.getContractFactory("RewardPool");
        RewardPool = await REWARDPOOL.deploy(esw.address, owner.address, emiFactory.address, usdt.address);
        await RewardPool.deployed();

        /* add routes
            wbtc-weth-usdt
            esw-weth-usdt
            uni-wbtc-weth-usdt
            wmatic-esw-weth-usdt
        */
        await RewardPool.addRoutes([wbtc.address, weth.address, usdt.address]);
        await RewardPool.addRoutes([esw.address, weth.address, usdt.address]);
        await RewardPool.addRoutes([uni.address, wbtc.address, weth.address, usdt.address]);
        await RewardPool.addRoutes([wmatic.address, esw.address, weth.address, usdt.address]);

        // try to deactivate route
        let routeArr = [wmatic.address, esw.address, weth.address, usdt.address];
        let resgetRouteBefore = await RewardPool.connect(Alice).getRoute(routeArr);
        await RewardPool.activationRoute(routeArr, false);
        let resgetRouteAfter = await RewardPool.connect(Alice).getRoute(routeArr);

        // check route correctness
        for (const iterator of routeArr.keys()) {
            expect(routeArr[iterator]).to.be.equal(resgetRouteBefore.routeRes[iterator]);
        }

        // check isActive parameter changed
        expect(resgetRouteBefore.isActiveRes).to.be.equal(true);
        expect(resgetRouteAfter.isActiveRes).to.be.equal(false);

        // try to duplicate
        await expect(RewardPool.addRoutes([wbtc.address, weth.address, usdt.address])).to.be.revertedWith(
            "route already added"
        );

        // try to add route not to usdt
        await expect(RewardPool.addRoutes([wbtc.address, weth.address, uni.address])).to.be.revertedWith(
            "set route to stable"
        );

        // try to add route from ton owner
        await expect(RewardPool.connect(Alice).addRoutes([esw.address, weth.address, usdt.address])).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );

        /* await RewardPool.setEmiPriceData(
            emiFactory.address, // kovan factory
            [esw.address, weth.address, usdt.address]
        ); */

        await esw.approve(RewardPool.address, tokensDec(1_000_000, 18));
        await RewardPool.notifyRewardAmount(tokensDec(1_000_000, 18));

        console.log("rewardRate", (await RewardPool.rewardRate()).toString());

        // owner send by 1_000_000 to Alice and Bob

        await esw.transfer(Alice.address, tokens(1_000_000));
        await esw.transfer(Bob.address, tokens(1_000_000));
        await esw.connect(Alice).approve(RewardPool.address, tokens(100));
        await esw.connect(Bob).approve(RewardPool.address, tokens(200));

        let pools = await emiRouter.getPoolDataList([wbtc.address, wbtc.address], [uni.address, weth.address]);
        let wbtc_uni_pool = await lpInstance.attach(pools[0].pool);
        let wbtc_weth_pool = await lpInstance.attach(pools[1].pool);

        //await RewardPool.connect(Alice).stake(, tokens(100), tokens(100));
        console.log(
            "wbtc_uni_pool (40 BTC + 100000 UNI = )",
            (await wbtc_uni_pool.balanceOf(owner.address)).toString(),
            "has no direct price in USDT"
        );
        console.log(
            "wbtc_weth_pool (100 BTC + 10000 WETH ~ 20000 WETH ~ (using weth-usdt 1:2000) 40000000 USDT ), \ntotal LP's =",
            (await wbtc_weth_pool.balanceOf(owner.address)).toString(),
            "1 LP = ",
            BigNumber.from("40000000000000")
                .mul(BigNumber.from("1000000000000000000"))
                .div(await wbtc_weth_pool.balanceOf(owner.address))
                .div(BigNumber.from("1000000"))
                .toString(),
            "USDT"
        );

        // send 10 LP to Alice, 1 LP to Bob
        await wbtc_weth_pool.transfer(Alice.address, tokens("10"));
        await wbtc_weth_pool.transfer(Bob.address, tokens("1"));

        // prepare for staking
        await wbtc_weth_pool.connect(Alice).approve(RewardPool.address, tokens("10"));
        await wbtc_weth_pool.connect(Bob).approve(RewardPool.address, tokens("1"));
        // prepare for incorrect stake
        await wbtc.transfer(Alice.address, tokensDec("10", 8));
        await wbtc.connect(Alice).approve(RewardPool.address, tokens("10"));

        // incorrect stake
        await expect(RewardPool.connect(Alice).stake(wbtc.address, tokens(10), tokens(10))).to.be.revertedWith("token incorrect or not LP");
        
        // correct stake 
        await RewardPool.connect(Alice).stake(wbtc_weth_pool.address, tokens(10), tokens(10));
        await RewardPool.connect(Bob).stake(wbtc_weth_pool.address, tokens(1), tokens(1));

        console.log("Alice stakes", await RewardPool.getStakedTokens(Alice.address));
        console.log("Bob stakes", await RewardPool.getStakedTokens(Bob.address));

        /*expect((await RewardPool.getStakedValuesinUSD(Alice.address))[0].toString()).to.be.equal("19999900");
        expect((await RewardPool.getStakedValuesinUSD(Alice.address))[1].toString()).to.be.equal("59999700");

        console.log(
            "USD balances, Alice's",
            (await RewardPool.getStakedValuesinUSD(Alice.address))[0].toString(),
            "whole balance",
            (await RewardPool.getStakedValuesinUSD(Alice.address))[1].toString()
        ); */

        // TODO: get prices between tokens on stake
        // TODO: make reward and test it

        await network.provider.send("evm_increaseTime", [2592000]); // 30 days to pass
        await network.provider.send("evm_mine");

        await RewardPool.connect(Alice).getReward();
        await RewardPool.connect(Bob).getReward();

        console.log("totalSupply", (await RewardPool.totalSupply()).toString());
        console.log("Alice earned()", (await RewardPool.earned(Alice.address)).toString());
        console.log("Bob earned()", (await RewardPool.earned(Bob.address)).toString());

        await network.provider.send("evm_increaseTime", [2592000]); // 30 days to pass
        await network.provider.send("evm_mine");

        console.log("totalSupply", (await RewardPool.totalSupply()).toString());
        console.log("Alice earned()", (await RewardPool.earned(Alice.address)).toString());
        console.log("Bob earned()", (await RewardPool.earned(Bob.address)).toString());

        await RewardPool.connect(Alice).exit();
        await RewardPool.connect(Bob).exit();

        console.log("totalSupply", (await RewardPool.totalSupply()).toString());
        console.log("Alice total earned", (await esw.balanceOf(Alice.address)).toString());
        console.log("Bob total earned", (await esw.balanceOf(Bob.address)).toString());
    });
});
