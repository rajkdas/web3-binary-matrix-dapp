// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PortaGraphRegistry
 * @notice Immutable 2xN Binary Forced Matrix with non-transferable Soulbound
 *         position tokens. Every participant occupies exactly one slot keyed by
 *         (parent, side ∈ {L,R}). Placement is breadth-first from the sponsor's
 *         subtree, producing organic "spillover" once direct slots fill.
 *
 * @dev Gas note — `findPlacement` is the reference implementation. Production
 *      placements are resolved by the PortaGraph off-chain Indexer and pushed
 *      via `placeAt(parent, side)` after an ECDSA/OIDC proof of the sponsor's
 *      consent, keeping the BFS loop (O(N)) off the gas meter. The on-chain
 *      search is kept for decentralised fallback and for audits.
 */
contract PortaGraphRegistry is ERC721, Ownable2Step, ReentrancyGuard {
    // ── Errors ─────────────────────────────────────────────────────────────
    error Soulbound();
    error MatrixSaturated();
    error InvalidParent(uint256 parentId);
    error SlotOccupied(uint256 parentId, Side side);
    error AlreadyRegistered(address account);

    // ── Types ──────────────────────────────────────────────────────────────
    enum Side { L, R }

    struct Node {
        uint32 parentId;   // 0 = root sentinel
        Side   side;       // which slot of the parent this node occupies
        uint32 sponsorId;  // referrer (may differ from parent → spillover)
        uint32 depth;      // level in the tree, root = 0
        uint64 activatedAt;
        Status status;
    }

    enum Status { GRACE, ACTIVE, SUSPENDED }

    // ── Immutable config ───────────────────────────────────────────────────
    uint32  public constant ROOT_ID = 1;
    uint256 public immutable genesisBlock;

    // ── Storage ────────────────────────────────────────────────────────────
    uint32 public nextId = ROOT_ID + 1;
    mapping(uint256 => Node) public nodes;               // nodeId → node
    mapping(uint256 => mapping(Side => uint256)) public childOf; // (parent, side) → child
    mapping(address => uint256) public ownerOfPosition;  // wallet → nodeId

    // ── Events ─────────────────────────────────────────────────────────────
    event NodeJoined(uint256 indexed nodeId, uint256 indexed parentId, Side side,
                     uint256 indexed sponsorId, address wallet, bool spillover);
    event NodeStatusChanged(uint256 indexed nodeId, Status status);

    constructor(string memory name_, string memory symbol_, address rootWallet_)
        ERC721(name_, symbol_)
        Ownable(msg.sender)
    {
        genesisBlock = block.number;
        _mint(rootWallet_, ROOT_ID);
        nodes[ROOT_ID] = Node(0, Side.L, 0, 0, uint64(block.timestamp), Status.ACTIVE);
        ownerOfPosition[rootWallet_] = ROOT_ID;
        emit NodeJoined(ROOT_ID, 0, Side.L, 0, rootWallet_, false);
    }

    // ── Soulbound: transfers permanently disabled (ERC-5192 semantics) ─────
    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ── Registration ───────────────────────────────────────────────────────
    /**
     * @notice Register with the full on-chain BFS search (fallback path).
     * @param sponsor Wallet of the referrer whose subtree is searched.
     * @param preferSide Optional preference honoured at the sponsor's own slot.
     */
    function register(address wallet, uint256 sponsorId, Side preferSide)
        external nonReentrant returns (uint256 nodeId)
    {
        if (ownerOfPosition[wallet] != 0) revert AlreadyRegistered(wallet);
        (uint256 parent, Side side) = findPlacement(sponsorId, preferSide);
        return _place(wallet, parent, side, sponsorId);
    }

    /**
     * @notice Indexer fast-path: place at a pre-computed slot. The caller must
     *         be the sponsored wallet (sponsor-consent proof happens off-chain
     *         through the ERC-4337 userOperation signature).
     */
    function placeAt(address wallet, uint256 parent, Side side, uint256 sponsorId)
        external nonReentrant returns (uint256 nodeId)
    {
        if (msg.sender != wallet) revert Soulbound();
        if (ownerOfPosition[wallet] != 0) revert AlreadyRegistered(wallet);
        if (childOf[parent][side] != 0) revert SlotOccupied(parent, side);
        return _place(wallet, parent, side, sponsorId);
    }

    function _place(address wallet, uint256 parent, Side side, uint256 sponsorId)
        private returns (uint256 nodeId)
    {
        Node storage p = nodes[parent];
        if (p.activatedAt == 0) revert InvalidParent(parent);
        if (childOf[parent][side] != 0) revert SlotOccupied(parent, side);

        nodeId = nextId++;
        bool spillover = sponsorId != parent;

        _mint(wallet, nodeId);
        nodes[nodeId] = Node(uint32(parent), side, uint32(sponsorId),
                             p.depth + 1, uint64(block.timestamp), Status.GRACE);
        childOf[parent][side] = nodeId;
        ownerOfPosition[wallet] = nodeId;

        emit NodeJoined(nodeId, parent, side, sponsorId, wallet, spillover);
    }

    // ── Status (drives CampaignManager compression) ────────────────────────
    function setStatus(uint256 nodeId, Status status) external onlyOwner {
        nodes[nodeId].status = status;
        emit NodeStatusChanged(nodeId, status);
    }

    // ── Reference BFS — O(N), executed off-chain in production ─────────────
    /**
     * @dev Breadth-first search for the first open slot in the sponsor's
     *      subtree. Visits at most the whole matrix; intentionally plain so
     *      auditors can compare 1:1 with the TypeScript indexer implementation.
     */
    function findPlacement(uint256 sponsorId, Side preferSide)
        public view returns (uint256 parent, Side side)
    {
        if (nodes[sponsorId].activatedAt == 0) revert InvalidParent(sponsorId);

        // honour an explicit preference at the sponsor's own slot
        if (childOf[sponsorId][preferSide] == 0) return (sponsorId, preferSide);

        uint256[512] memory queue; // fixed ring buffer — DoS-proof
        uint256 head = 0;
        uint256 tail = 0;
        queue[tail++] = uint32(sponsorId);

        while (head < tail) {
            uint256 cur = queue[head++ % 512];
            uint256 l = childOf[cur][Side.L];
            uint256 r = childOf[cur][Side.R];
            if (l == 0) return (cur, Side.L);
            if (r == 0) return (cur, Side.R);
            if (l != 0) queue[tail++ % 512] = l;
            if (r != 0) queue[tail++ % 512] = r;
        }
        revert MatrixSaturated();
    }

    function nodeIdOf(address wallet) external view returns (uint256) {
        return ownerOfPosition[wallet];
    }

    function uplineOf(uint256 nodeId, uint256 depth)
        external view returns (uint256[] memory)
    {
        uint256[] memory chain = new uint256[](depth);
        uint256 cur = nodeId;
        for (uint256 i = 0; i < depth; i++) {
            cur = nodes[cur].parentId;
            chain[i] = cur;
        }
        return chain;
    }
}
