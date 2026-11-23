// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "../contracts/AgentTrail.sol";

/// @notice Fork test against real BSC mainnet state.
/// Proves the gate works with the REAL SPACE ID Agent ID contract and the
/// user's REAL wallet (0xF865...), which holds Agent ID `imperson`.
/// Run: forge test --match-contract AgentTrailForkTest --fork-url https://bsc-rpc.publicnode.com
contract AgentTrailForkTest is Test {
    address internal constant USER = 0xF865270e05876eD4E9F420f942AE337B9fA3a142;
    address internal constant NOBODY = address(0x1234);

    AgentTrail internal trail;

    function setUp() public {
        trail = new AgentTrail();
    }

    function testUserWalletHoldsAgentId() public view {
        assertTrue(trail.hasAgentId(USER));
    }

    function testNonHolderRevertsOnFork() public {
        assertFalse(trail.hasAgentId(NOBODY));
        vm.prank(NOBODY);
        vm.expectRevert(AgentTrail.NeedAgentId.selector);
        trail.checkIn("no id");
    }

    function testUserCanCheckInOnFork() public {
        vm.prank(USER);
        trail.checkIn("first trail mark");
        assertEq(trail.streak(USER), 1);
        assertEq(trail.agentCount(), 1);
        assertEq(trail.totalCheckInCount(), 1);
    }

    function testDeployGas() public {
        uint256 gasBefore = gasleft();
        new AgentTrail();
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("deploy gas (approx, incl. test overhead)", used);
        // Real deploy should be well under 1M gas; at 0.05 gwei that's < 0.00005 BNB.
        assertLt(used, 1_000_000);
    }
}
