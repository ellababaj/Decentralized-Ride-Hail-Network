# 🚗 Decentralized Ride-Hail Network

Welcome to **RideChain**, the peer-to-peer ride-hailing revolution on the Stacks blockchain! Say goodbye to greedy centralized platforms skimming 20-30% off every fare. Here, riders and drivers connect directly, payments flow via smart contracts, and you keep more of what you earn—all secured by Bitcoin's finality through Stacks.

Built with Clarity smart contracts, this project solves the real-world pain of exploitative fees in ride-hailing (think Uber/Lyft cuts eating into driver income and inflating rider costs). Instead, use micro-fees for on-chain ops, and let the community govern disputes. Fair, fast, and fully decentralized!

## ✨ Features

🚀 **Direct Peer Matching** - Riders post requests; drivers bid/accept without middlemen  
💰 **Fee-Free Payments** - Escrow holds crypto (STX or SIP-010 tokens) until ride ends—no platform rake  
⭐ **On-Chain Ratings** - Transparent reviews build trust and reputation scores  
🛡️ **Dispute Resolution** - Community-voted arbitration keeps things fair  
📍 **Geo-Verified Rides** - Optional off-chain GPS integration with on-chain proofs  
🔒 **Secure User Registry** - Verify identities and vehicles without doxxing  

## 📜 Smart Contracts

Powered by 8 Clarity contracts for modularity and security. Each handles a core piece—deploy them in sequence for full stack.

1. **UserRegistry** - Registers riders/drivers with wallets, roles, and basic KYC hashes (e.g., license proof).  
2. **VehicleRegistry** - Validates driver vehicles via VIN hashes and insurance proofs.  
3. **RideFactory** - Creates new ride instances from requests, minting unique ride IDs.  
4. **RideCore** - Manages ride lifecycle: request posting, acceptance, start/end timestamps, and route hashes.  
5. **EscrowVault** - Locks payments on ride start; releases to driver on completion or refunds on cancel.  
6. **RatingLedger** - Records mutual ratings post-ride, computing reputation scores for future matching.  
7. **DisputeArbiter** - Handles claims with timed voting (e.g., slash escrow for bad actors).  
8. **TokenGateway** - Bridges STX/SIP-010 tokens for fares, with optional utility token for incentives.  

(Pro tip: Use Clarinet for local testing—each contract is atomic and upgradable via traits!)

## 🛣 How It Works

**For Riders**  
- Register in UserRegistry with your wallet.  
- Call `post-ride-request` in RideCore: specify pickup/dropoff hashes, max fare (in STX), and urgency.  
- Browse/accept driver bids via `accept-bid`.  
- GPS confirms start → EscrowVault locks your payment.  
- End ride with `complete-ride` → Get rated and refunded if issues arise!  

**For Drivers**  
- Register yourself + vehicle in UserRegistry and VehicleRegistry.  
- Scan open requests in RideCore and `submit-bid` with your quote.  
- Rider accepts? Lock in with `confirm-pickup` and hit the road.  
- On dropoff, call `request-completion` → Escrow releases funds minus gas.  
- Rate the rider in RatingLedger to boost your rep and unlock premium matches.  

**Disputes?**  
File in DisputeArbiter within 1 hour—peers vote using staked tokens. Loser pays a slash fee to the pot. No courts, just code!

## 🚀 Getting Started

Clone the repo, fire up Clarinet, and deploy to testnet. Integrate a simple React dApp for the UI—ride requests via wallet connect. Future: Add oracle feeds for real-time geo.

Join the ride to a fee-free future! What's your first destination? 