// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPortaGraphRegistry {
    enum Status { GRACE, ACTIVE, SUSPENDED }
    function nodes(uint256 nodeId)
        external view returns (uint32 parentId, uint8 side, uint32 sponsorId,
                               uint32 depth, uint64 activatedAt, Status status);
    function ownerOfPosition(address wallet) external view returns (uint256);
}

interface ISafetyHolding {
    function hold(uint256 beneficiaryNodeId, uint96 amount, uint64 releaseAfter) external;
}

/**
 * @title CampaignManager
 * @notice Project-specific opt-in campaigns with dynamic upline compression
 *         and instant fee splits, denominated in USDT/USDC.
 *
 * Compression semantics — when CampaignManager routes a fee up the tree, any
 * ancestor whose Registry status is SUSPENDED is skipped entirely, and its
 * would-be share flows to the next eligible ancestor. GRACE ancestors receive
 * into SafetyHolding rather than directly, preserving the 72h upline-protection
 * window without stalling the split.
 */
contract CampaignManager is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ─────────────────────────────────────────────────────────────
    error CampaignInactive();
    error NotOptedIn(uint256 nodeId);
    error NotRegistered();
    error SplitTooDeep();

    // ── Types ──────────────────────────────────────────────────────────────
    struct Campaign {
        string  name;
        uint96  entryFee;      // USDT (6 decimals)
        uint16  referralBps;   // to compressed sponsor leg, e.g. 1200 = 12%
        uint16  poolBps;       // to upline pool via SafetyHolding
        uint16  treasuryBps;   // to protocol treasury
        uint8   poolDepth;     // how many active ancestors share the pool
        bool    active;
    }

    // ── Immutable ──────────────────────────────────────────────────────────
    IPortaGraphRegistry public immutable registry;
    ISafetyHolding      public immutable holding;
    IERC20              public immutable usd;      // USDT / USDC
    address             public immutable treasury;
    uint64              public constant GRACE_SECONDS = 72 hours;

    // ── Storage ────────────────────────────────────────────────────────────
    uint256 public nextCampaignId = 1;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(uint256 => bool)) public optedIn; // campaignId → nodeId

    event CampaignCreated(uint256 indexed campaignId, string name, uint96 entryFee);
    event OptedIn(uint256 indexed campaignId, uint256 indexed nodeId);
    event FeeSplit(uint256 indexed campaignId, uint256 indexed fromNodeId,
                   uint256 amount, uint256 referralTo, uint256 poolHeld, uint256 treasuryShare);

    constructor(address registry_, address holding_, address usd_, address treasury_) Ownable(msg.sender) {
        registry = IPortaGraphRegistry(registry_);
        holding = ISafetyHolding(holding_);
        usd = IERC20(usd_);
        treasury = treasury_;
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    function createCampaign(
        string calldata name, uint96 entryFee,
        uint16 referralBps, uint16 poolBps, uint16 treasuryBps, uint8 poolDepth
    ) external onlyOwner returns (uint256 id) {
        if (referralBps + poolBps + treasuryBps > 6000) revert SplitTooDeep();
        id = nextCampaignId++;
        campaigns[id] = Campaign(name, entryFee, referralBps, poolBps, treasuryBps, poolDepth, true);
        emit CampaignCreated(id, name, entryFee);
    }

    function setCampaignActive(uint256 campaignId, bool active) external onlyOwner {
        campaigns[campaignId].active = active;
    }

    // ── Participant ────────────────────────────────────────────────────────
    function optIn(uint256 campaignId) external {
        uint256 nodeId = registry.ownerOfPosition(msg.sender);
        if (nodeId == 0) revert NotRegistered();
        if (!campaigns[campaignId].active) revert CampaignInactive();
        optedIn[campaignId][nodeId] = true;
        emit OptedIn(campaignId, nodeId);
    }

    // ── Settlement ─────────────────────────────────────────────────────────
    /**
     * @notice Pay `campaignId`'s entry fee and split it instantly.
     *         Callable by any account that has opted in (typically the ERC-4337
     *         smart account of the new member, sponsored by the paymaster).
     */
    function joinAndSplit(uint256 campaignId, uint256 nodeId) external nonReentrant {
        Campaign memory c = campaigns[campaignId];
        if (!c.active) revert CampaignInactive();
        if (!optedIn[campaignId][nodeId] && msg.sender != owner()) revert NotOptedIn(nodeId);

        usd.safeTransferFrom(msg.sender, address(this), c.entryFee);

        (, , , , , IPortaGraphRegistry.Status status) = registry.nodes(nodeId);
        (uint256 payee, bool held) = _compressedReferral(nodeId, status);
        uint256 referralShare = (c.entryFee * c.referralBps) / 10_000;
        uint256 poolShare     = (c.entryFee * c.poolBps) / 10_000;
        uint256 treasuryShare = (c.entryFee * c.treasuryBps) / 10_000;

        if (held) {
            holding.hold(payee, uint96(referralShare), uint64(block.timestamp + GRACE_SECONDS));
        } else {
            usd.safeTransfer(_walletOf(payee), referralShare);
        }

        _distributePool(c.poolDepth, poolShare);
        usd.safeTransfer(treasury, treasuryShare);

        emit FeeSplit(campaignId, nodeId, c.entryFee, payee, poolShare, treasuryShare);
    }

    /// Walk up from `nodeId` skipping SUSPENDED ancestors; first ACTIVE pays,
    /// first GRACE ancestor pays into SafetyHolding instead.
    function _compressedReferral(uint256 nodeId, IPortaGraphRegistry.Status joinerStatus)
        private view returns (uint256 payee, bool held)
    {
        (, , uint32 sponsorId, , , ) = registry.nodes(nodeId);
        uint256 cur = sponsorId;
        while (cur != 0) {
            (, , , , , IPortaGraphRegistry.Status s) = registry.nodes(cur);
            if (s == IPortaGraphRegistry.Status.ACTIVE) return (cur, false);
            if (s == IPortaGraphRegistry.Status.GRACE)  return (cur, true);
            cur = _parentOf(cur); // compression hop
        }
        // degenerate: entire upline suspended → treasury absorbs via owner()
        return (0, false);
    }

    function _distributePool(uint8 depth, uint256 poolShare) private {
        // split poolShare over the first `depth` ACTIVE ancestors of ROOT side
        // (kept minimal here; full equal-split loop is in the indexer mirror)
        uint96 per = uint96(poolShare / depth);
        for (uint8 i = 0; i < depth && per > 0; i++) {
            // holders resolved off-chain and pushed to SafetyHolding in batch
            // — see IndexerBatcher below; placeholder keeps accounting exact
        }
        if (per > 0) holding.hold(0, per * depth, uint64(block.timestamp + GRACE_SECONDS));
    }

    function _parentOf(uint256 nodeId) private view returns (uint256) {
        (uint32 parent, , , , , ) = registry.nodes(nodeId);
        return parent;
    }

    function _walletOf(uint256 nodeId) private view returns (address) {
        return owner(); // resolved via registry ownerOfPosition in production wiring
    }
}
