// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IAgentID {
    function balanceOf(address owner) external view returns (uint256);
}

/// @title AgentTrail
/// @notice Daily check-in + agent activity log for Agent ID holders on BNB Chain.
/// @dev Free (gas only). No token, no rewards, no fees, no owner powers.
/// Only addresses holding a SPACE ID Agent ID (ERC-721, 0x60b9...) can check in.
/// Check-ins are public on-chain events; notes are emitted, never stored.
contract AgentTrail {
    IAgentID public constant AGENT_ID =
        IAgentID(0x60B9262456dE011F7d15a54CdD8c48bAaa8B022F);

    mapping(address => uint256) public lastDay;
    mapping(address => uint256) public streak;
    mapping(address => uint256) public checkInsOf;
    mapping(address => bool) public isAgent;
    address[] public agents;
    uint256 public totalCheckInCount;

    event CheckIn(address indexed agent, uint256 indexed day, uint256 streak, string note);

    error NeedAgentId();
    error AlreadyCheckedInToday();
    error NoteTooLong();

    /// @notice Check in once per UTC day. `note` (max 140 bytes) is what your
    /// agent did today; it is emitted as an event, not stored.
    function checkIn(string calldata note) external {
        if (AGENT_ID.balanceOf(msg.sender) == 0) revert NeedAgentId();
        if (bytes(note).length > 140) revert NoteTooLong();
        uint256 day = block.timestamp / 1 days;
        // lastDay == 0 means "never checked in" (day 0 itself is Jan 1970).
        if (lastDay[msg.sender] != 0 && lastDay[msg.sender] == day) revert AlreadyCheckedInToday();
        uint256 s = lastDay[msg.sender] == day - 1 ? streak[msg.sender] + 1 : 1;
        streak[msg.sender] = s;
        lastDay[msg.sender] = day;
        checkInsOf[msg.sender] += 1;
        totalCheckInCount += 1;
        if (!isAgent[msg.sender]) {
            isAgent[msg.sender] = true;
            agents.push(msg.sender);
        }
        emit CheckIn(msg.sender, day, s, note);
    }

    function agentCount() external view returns (uint256) {
        return agents.length;
    }

    function agentAt(uint256 i) external view returns (address) {
        return agents[i];
    }

    function hasAgentId(address a) external view returns (bool) {
        return AGENT_ID.balanceOf(a) > 0;
    }
}
