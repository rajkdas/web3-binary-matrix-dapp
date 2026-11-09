// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../PortaGraphRegistry.sol";

contract RegistryTest is Test {
    PortaGraphRegistry registry;
    address alice = makeAddr("alice");   // root wallet
    address bob    = makeAddr("bob");
    address carol  = makeAddr("carol");
    address dave   = makeAddr("dave");
    address erin   = makeAddr("erin");

    function setUp() public {
        registry = new PortaGraphRegistry("PortaGraph Position", "pgPOS", alice);
    }

    function test_GenesisNodeIsMintedToRoot() public view {
        assertEq(registry.ownerOf(PortaGraphRegistry.ROOT_ID), alice);
        assertEq(registry.nodes(PortaGraphRegistry.ROOT_ID).depth, 0);
    }

    function test_SBT_TransfersRevert() public {
        vm.prank(alice);
        vm.expectRevert(PortaGraphRegistry.Soulbound.selector);
        registry.transferFrom(alice, bob, PortaGraphRegistry.ROOT_ID);
    }

    function test_SBT_ApprovalThenTransferAlsoReverts() public {
        vm.prank(alice);
        registry.approve(bob, PortaGraphRegistry.ROOT_ID);
        vm.prank(bob);
        vm.expectRevert(PortaGraphRegistry.Soulbound.selector);
        registry.transferFrom(alice, bob, PortaGraphRegistry.ROOT_ID);
    }

    function test_FirstTwoJoinsFillDirectSlots() public {
        uint256 b = registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        uint256 c = registry.register(carol, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        assertEq(b, 2);
        assertEq(c, 3);
        assertEq(registry.childOf(1, PortaGraphRegistry.Side.L), 2);
        assertEq(registry.childOf(1, PortaGraphRegistry.Side.R), 3);
    }

    function test_BFS_SpilloverPlacesUnderFirstOpenSlot() public {
        registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        registry.register(carol, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        // dave sponsors under ROOT but both ROOT slots are taken → BFS spills
        uint256 d = registry.register(dave, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.R);
        (uint32 parent, , uint32 sponsor, , , ) = registry.nodes(d);
        assertEq(parent, 2);              // placed under bob (first open BFS slot)
        assertEq(sponsor, 1);             // sponsored by root — spillover evidence
    }

    function test_PreferSide_HonoredAtSponsorSlot() public {
        uint256 d = registry.register(dave, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.R);
        assertEq(registry.childOf(1, PortaGraphRegistry.Side.R), d);
    }

    function test_DepthIncreasesDownTheTree() public {
        uint256 b = registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        uint256 d = registry.register(dave, b, PortaGraphRegistry.Side.L);
        uint256 e = registry.register(erin, d, PortaGraphRegistry.Side.R);
        assertEq(registry.nodes(b).depth, 1);
        assertEq(registry.nodes(d).depth, 2);
        assertEq(registry.nodes(e).depth, 3);
    }

    function test_DoubleRegistrationReverts() public {
        registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        vm.expectRevert(abi.encodeWithSelector(PortaGraphRegistry.AlreadyRegistered.selector, bob));
        registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.R);
    }

    function test_OccupiedSlotRevertsOnPlaceAt() public {
        registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(
            PortaGraphRegistry.SlotOccupied.selector, uint256(1), uint8(0)));
        registry.placeAt(carol, 1, PortaGraphRegistry.Side.L, 1);
    }

    function test_SetStatusRoutesCompression() public {
        uint256 b = registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        registry.setStatus(b, PortaGraphRegistry.Status.SUSPENDED);
        assertEq(uint8(registry.nodes(b).status), uint8(PortaGraphRegistry.Status.SUSPENDED));
    }

    function test_UplineChainWalk() public {
        uint256 b = registry.register(bob, PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
        uint256 d = registry.register(dave, b, PortaGraphRegistry.Side.L);
        uint256[] memory up = registry.uplineOf(d, 2);
        assertEq(up[0], b);
        assertEq(up[1], 1);
    }

    function test_Fuzz_PlacementNeverCollides(uint8 n) public {
        vm.assume(n > 0 && n < 12);
        address[12] memory wallets;
        for (uint8 i = 0; i < n; i++) {
            wallets[i] = address(uint160(0xA000 + i));
            uint256 id = registry.register(wallets[i], PortaGraphRegistry.ROOT_ID, PortaGraphRegistry.Side.L);
            (uint32 parent, , , , , ) = registry.nodes(id);
            assertTrue(registry.childOf(parent, registry.nodes(id).side) == id);
        }
    }
}
