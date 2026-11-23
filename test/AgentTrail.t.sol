// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Test.sol";
import "../contracts/AgentTrail.sol";

/// @notice Minimal stand-in for the SPACE ID Agent ID ERC-721.
/// Its runtime code is etched at the real Agent ID address in setUp.
contract MockAgentID {
    mapping(address => uint256) public balanceOf;

    function mint(address a) external {
        balanceOf[a] = 1;
    }
}

contract AgentTrailTest is Test {
    address internal constant AGENT_ID_ADDR = 0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F;

    AgentTrail internal trail;
    MockAgentID internal mock;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    event CheckIn(address indexed agent, uint256 indexed day, uint256 streak, string note);

    function setUp() public {
        // Realistic timestamp (Nov 2026) so "day" behaves like mainnet.
        vm.warp(1795430000);
        mock = new MockAgentID();
        // Point the real Agent ID address at the mock's code.
        vm.etch(AGENT_ID_ADDR, address(mock).code);
        trail = new AgentTrail();
    }

    function testNonHolderCannotCheckIn() public {
        vm.prank(alice);
        vm.expectRevert(AgentTrail.NeedAgentId.selector);
        trail.checkIn("hello");
    }

    function testFirstCheckIn() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CheckIn(alice, block.timestamp / 1 days, 1, "shipped a feature");
        trail.checkIn("shipped a feature");
        assertEq(trail.streak(alice), 1);
        assertEq(trail.checkInsOf(alice), 1);
        assertEq(trail.totalCheckInCount(), 1);
        assertEq(trail.agentCount(), 1);
        assertEq(trail.agentAt(0), alice);
        assertTrue(trail.isAgent(alice));
    }

    function testSecondCheckInSameDayReverts() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        vm.prank(alice);
        trail.checkIn("day one");
        vm.prank(alice);
        vm.expectRevert(AgentTrail.AlreadyCheckedInToday.selector);
        trail.checkIn("again");
    }

    function testStreakIncrementsNextDay() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        vm.prank(alice);
        trail.checkIn("day one");
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        trail.checkIn("day two");
        assertEq(trail.streak(alice), 2);
        assertEq(trail.checkInsOf(alice), 2);
    }

    function testStreakResetsAfterGap() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        vm.prank(alice);
        trail.checkIn("day one");
        vm.warp(block.timestamp + 3 days);
        vm.prank(alice);
        trail.checkIn("back again");
        assertEq(trail.streak(alice), 1);
    }

    function testNoteTooLongReverts() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        string memory longNote = new string(141);
        vm.prank(alice);
        vm.expectRevert(AgentTrail.NoteTooLong.selector);
        trail.checkIn(longNote);
    }

    function testNote140BytesOk() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        string memory note = new string(140);
        vm.prank(alice);
        trail.checkIn(note);
        assertEq(trail.streak(alice), 1);
    }

    function testTwoHoldersCountedSeparately() public {
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        MockAgentID(AGENT_ID_ADDR).mint(bob);
        vm.prank(alice);
        trail.checkIn("alice note");
        vm.prank(bob);
        trail.checkIn("bob note");
        assertEq(trail.agentCount(), 2);
        assertEq(trail.totalCheckInCount(), 2);
        assertEq(trail.streak(bob), 1);
    }

    function testHasAgentIdView() public {
        assertFalse(trail.hasAgentId(alice));
        MockAgentID(AGENT_ID_ADDR).mint(alice);
        assertTrue(trail.hasAgentId(alice));
    }
}
