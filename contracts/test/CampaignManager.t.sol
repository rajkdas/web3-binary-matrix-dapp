// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../CampaignManager.sol";
import "../SafetyHolding.sol";

/// @dev Minimal doubles — the full wiring is covered by integration tests.
contract RegistryDouble {
    struct Node { uint32 parentId; uint8 side; uint32 sponsorId; }
    mapping(uint256 => Node) public nodes;
    mapping(address => uint256) public ownerOfPosition;
    uint256 public nextId = 2;

    function addMember(address wallet, uint32 parent, uint32 sponsor) external returns (uint256 id) {
        id = nextId++;
        nodes[id] = Node(parent, 0, sponsor);
        ownerOfPosition[wallet] = id;
    }
    function suspend(uint256 id) external { }
}

contract USDTDouble {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amt) external { balanceOf[to] += amt; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) {
        balanceOf[msg.sender] -= a; balanceOf[to] += a; return true;
    }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        allowance[f][msg.sender] -= a; balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
}

contract CampaignManagerTest is Test {
    RegistryDouble registry;
    SafetyHolding holding;
    USDTDouble usdt;
    CampaignManager campaigns;

    address admin   = makeAddr("admin");
    address sponsor = makeAddr("sponsor");
    address joiner  = makeAddr("joiner");
    address treasury = makeAddr("treasury");

    uint256 sponsorId;
    uint256 joinerId;

    function setUp() public {
        registry = new RegistryDouble();
        usdt = new USDTDouble();
        holding = new SafetyHolding(address(usdt), 72 hours);
        vm.prank(admin);
        campaigns = new CampaignManager(
            address(registry), address(holding), address(usdt), treasury
        );

        sponsorId = registry.addMember(sponsor, 1, 1);
        joinerId  = registry.addMember(joiner, sponsorId, sponsorId);

        usdt.mint(joiner, 10_000e6);
        vm.prank(admin);
        campaigns.createCampaign("Launch", 500e6, 1200, 600, 200, 5);
        vm.prank(joiner);
        campaigns.optIn(joinerId);
    }

    function test_OptInRecordsMembership() public view {
        assertTrue(campaigns.optedIn(1, joinerId));
    }

    function test_JoinAndSplit_PaysReferralImmediately() public {
        uint256 before = usdt.balanceOf(sponsor);
        vm.startPrank(joiner);
        usdt.approve(address(campaigns), 500e6);
        campaigns.joinAndSplit(1, joinerId);
        vm.stopPrank();
        uint256 referral = (500e6 * 1200) / 10_000; // 60 USDT
        assertEq(usdt.balanceOf(sponsor) - before, referral);
    }

    function test_JoinAndSplit_HoldsPoolShare72h() public {
        vm.startPrank(joiner);
        usdt.approve(address(campaigns), 500e6);
        campaigns.joinAndSplit(1, joinerId);
        vm.stopPrank();
        uint256 poolShare = (500e6 * 600) / 10_000; // 30 USDT
        (uint256 pending, uint64 maturesAt) = holding.pendingOf(0);
        assertEq(pending, poolShare);
        assertEq(maturesAt, block.timestamp + 72 hours);
    }

    function test_Release_RevertsBeforeMaturity() public {
        vm.startPrank(joiner);
        usdt.approve(address(campaigns), 500e6);
        campaigns.joinAndSplit(1, joinerId);
        vm.stopPrank();
        vm.expectRevert();
        holding.releaseAll(0);
    }

    function test_Release_AfterMaturitySucceeds() public {
        vm.startPrank(joiner);
        usdt.approve(address(campaigns), 500e6);
        campaigns.joinAndSplit(1, joinerId);
        vm.stopPrank();
        vm.warp(block.timestamp + 72 hours + 1);
        holding.releaseAll(0);
        (uint256 pending, ) = holding.pendingOf(0);
        assertEq(pending, 0);
    }

    function test_Reverse_BySafetySignerOnly() public {
        vm.startPrank(joiner);
        usdt.approve(address(campaigns), 500e6);
        campaigns.joinAndSplit(1, joinerId);
        vm.stopPrank();

        vm.prank(joiner);
        vm.expectRevert(SafetyHolding.NotSafetySigner.selector);
        holding.reverse(1, "chargeback");

        vm.prank(admin);
        holding.reverse(1, "chargeback");
        assertTrue(holding.holds(1).reversed);
    }

    function test_SplitAbove60PercentReverts() public {
        vm.prank(admin);
        vm.expectRevert(CampaignManager.SplitTooDeep.selector);
        campaigns.createCampaign("Greedy", 100e6, 4000, 1500, 1000, 5);
    }

    function test_InactiveCampaignBlocksOptIn() public {
        vm.prank(admin);
        campaigns.setCampaignActive(1, false);
        vm.prank(joiner);
        vm.expectRevert(CampaignManager.CampaignInactive.selector);
        campaigns.optIn(joinerId);
    }
}
