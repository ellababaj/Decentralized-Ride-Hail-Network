import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV, optionalCV, someCV, noneCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_RIDE_NOT_FOUND = 101;
const ERR_INVALID_PICKUP_HASH = 102;
const ERR_INVALID_DROPOFF_HASH = 103;
const ERR_INVALID_MAX_FARE = 104;
const ERR_INVALID_URGENCY = 105;
const ERR_RIDE_ALREADY_EXISTS = 106;
const ERR_NOT_RIDER = 107;
const ERR_NOT_DRIVER = 108;
const ERR_BID_TOO_HIGH = 109;
const ERR_BID_ALREADY_SUBMITTED = 110;
const ERR_RIDE_NOT_REQUESTED = 111;
const ERR_RIDE_ALREADY_ACCEPTED = 112;
const ERR_RIDE_NOT_ACCEPTED = 113;
const ERR_INVALID_GEO_HASH = 114;
const ERR_RIDE_INVALID_STATUS = 115;
const ERR_CANCEL_TIMEOUT = 116;
const ERR_USER_NOT_REGISTERED = 117;

interface Ride {
  rider: string;
  driver: string | null;
  status: string;
  pickupHash: string;
  dropoffHash: string;
  maxFare: bigint;
  bidFare: bigint | null;
  urgency: bigint;
  createdAt: bigint;
  acceptedAt: bigint | null;
  startedAt: bigint | null;
  completedAt: bigint | null;
  routeHash: string | null;
  reputationCheck: boolean;
}

interface Bid {
  bidAmount: bigint;
  submittedAt: bigint;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class RideCoreMock {
  state: {
    nextRideId: bigint;
    rides: Map<bigint, Ride>;
    bids: Map<string, Bid>;
  } = {
    nextRideId: BigInt(0),
    rides: new Map(),
    bids: new Map(),
  };
  blockHeight: bigint = BigInt(0);
  caller: string = "ST1TEST";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextRideId: BigInt(0),
      rides: new Map(),
      bids: new Map(),
    };
    this.blockHeight = BigInt(0);
    this.caller = "ST1TEST";
  }

  getRide(rideId: bigint): Result<Ride | null> {
    const ride = this.state.rides.get(rideId);
    return { ok: true, value: ride || null };
  }

  getBid(rideId: bigint, driver: string): Result<Bid | null> {
    const key = `${rideId}-${driver}`;
    const bid = this.state.bids.get(key);
    return { ok: true, value: bid || null };
  }

  getOpenRequests(): Result<{ rideIds: bigint[] }> {
    const openRides: bigint[] = [];
    for (let id = 0n; id < this.state.nextRideId; id++) {
      const ride = this.state.rides.get(id);
      if (ride && ride.status === "requested") {
        openRides.push(id);
      }
    }
    return { ok: true, value: { rideIds: openRides } };
  }

  postRideRequest(
    pickupHash: string,
    dropoffHash: string,
    maxFare: bigint,
    urgency: bigint
  ): Result<bigint> {
    if (pickupHash.length !== 64 || dropoffHash.length !== 64) return { ok: false, value: ERR_INVALID_PICKUP_HASH };
    if (dropoffHash.length !== 64) return { ok: false, value: ERR_INVALID_DROPOFF_HASH };
    if (maxFare <= 0n) return { ok: false, value: ERR_INVALID_MAX_FARE };
    if (urgency <= 0n || urgency > 3n) return { ok: false, value: ERR_INVALID_URGENCY };
    const newId = this.state.nextRideId;
    if (this.state.rides.has(newId)) return { ok: false, value: ERR_RIDE_ALREADY_EXISTS };
    const ride: Ride = {
      rider: this.caller,
      driver: null,
      status: "requested",
      pickupHash,
      dropoffHash,
      maxFare,
      bidFare: null,
      urgency,
      createdAt: this.blockHeight,
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      routeHash: null,
      reputationCheck: true,
    };
    this.state.rides.set(newId, ride);
    this.state.nextRideId++;
    return { ok: true, value: newId };
  }

  submitBid(rideId: bigint, bidAmount: bigint): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: ERR_RIDE_NOT_FOUND };
    if (ride.status !== "requested") return { ok: false, value: ERR_RIDE_NOT_REQUESTED };
    if (bidAmount <= 0n) return { ok: false, value: ERR_INVALID_MAX_FARE };
    if (bidAmount > ride.maxFare) return { ok: false, value: ERR_BID_TOO_HIGH };
    const key = `${rideId}-${this.caller}`;
    if (this.state.bids.has(key)) return { ok: false, value: ERR_BID_ALREADY_SUBMITTED };
    this.state.bids.set(key, { bidAmount, submittedAt: this.blockHeight });
    return { ok: true, value: true };
  }

  acceptBid(rideId: bigint, selectedDriver: string): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: ERR_RIDE_NOT_FOUND };
    if (ride.status !== "requested") return { ok: false, value: ERR_RIDE_NOT_REQUESTED };
    if (ride.rider !== this.caller) return { ok: false, value: ERR_NOT_RIDER };
    const key = `${rideId}-${selectedDriver}`;
    const bid = this.state.bids.get(key);
    if (!bid || bid.bidAmount > ride.maxFare) return { ok: false, value: ERR_RIDE_NOT_ACCEPTED };
    const updatedRide: Ride = {
      ...ride,
      driver: selectedDriver,
      status: "accepted",
      bidFare: bid.bidAmount,
      acceptedAt: this.blockHeight,
    };
    this.state.rides.set(rideId, updatedRide);
    return { ok: true, value: true };
  }

  startRide(rideId: bigint, routeHash: string): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: ERR_RIDE_NOT_FOUND };
    if (ride.status !== "accepted") return { ok: false, value: ERR_RIDE_INVALID_STATUS };
    if (ride.driver !== this.caller) return { ok: false, value: ERR_NOT_DRIVER };
    if (routeHash.length !== 64) return { ok: false, value: ERR_INVALID_GEO_HASH };
    const updatedRide: Ride = {
      ...ride,
      status: "started",
      routeHash,
      startedAt: this.blockHeight,
    };
    this.state.rides.set(rideId, updatedRide);
    return { ok: true, value: true };
  }

  completeRide(rideId: bigint): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: ERR_RIDE_NOT_FOUND };
    if (ride.status !== "started") return { ok: false, value: ERR_RIDE_INVALID_STATUS };
    const updatedRide: Ride = {
      ...ride,
      status: "completed",
      completedAt: this.blockHeight,
    };
    this.state.rides.set(rideId, updatedRide);
    return { ok: true, value: true };
  }

  cancelRide(rideId: bigint): Result<boolean> {
    const ride = this.state.rides.get(rideId);
    if (!ride) return { ok: false, value: ERR_RIDE_NOT_FOUND };
    if (ride.status !== "requested") return { ok: false, value: ERR_RIDE_INVALID_STATUS };
    if (ride.rider !== this.caller) return { ok: false, value: ERR_NOT_RIDER };
    const timeSince = this.blockHeight - ride.createdAt;
    if (timeSince > 10n) return { ok: false, value: ERR_CANCEL_TIMEOUT };
    const updatedRide: Ride = {
      ...ride,
      driver: null,
      status: "cancelled",
      bidFare: null,
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
      routeHash: null,
      reputationCheck: false,
    };
    this.state.rides.set(rideId, updatedRide);
    return { ok: true, value: true };
  }
}

describe("RideCore", () => {
  let contract: RideCoreMock;

  beforeEach(() => {
    contract = new RideCoreMock();
    contract.reset();
  });

  it("posts a ride request successfully", () => {
    const result = contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0n);
    const ride = contract.getRide(0n);
    expect(ride.ok).toBe(true);
    expect(ride.value).toMatchObject({
      rider: "ST1TEST",
      status: "requested",
      pickupHash: "a".repeat(64),
      dropoffHash: "b".repeat(64),
      maxFare: 100n,
      urgency: 1n,
      reputationCheck: true,
    });
  });

  it("rejects invalid pickup hash length", () => {
    const result = contract.postRideRequest("short", "b".repeat(64), 100n, 1n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PICKUP_HASH);
  });

  it("rejects invalid max fare", () => {
    const result = contract.postRideRequest("a".repeat(64), "b".repeat(64), 0n, 1n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_FARE);
  });

  it("rejects invalid urgency", () => {
    const result = contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 0n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_URGENCY);
  });

  it("submits a bid successfully", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    const result = contract.submitBid(0n, 50n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const bid = contract.getBid(0n, "ST2DRIVER");
    expect(bid.ok).toBe(true);
    expect(bid.value).toMatchObject({ bidAmount: 50n });
  });

  it("rejects bid too high", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    const result = contract.submitBid(0n, 150n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BID_TOO_HIGH);
  });

  it("rejects duplicate bid", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    const result = contract.submitBid(0n, 60n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_BID_ALREADY_SUBMITTED);
  });

  it("accepts a bid successfully", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    contract.caller = "ST1TEST";
    const result = contract.acceptBid(0n, "ST2DRIVER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const ride = contract.getRide(0n);
    expect(ride.ok).toBe(true);
    expect(ride.value).toMatchObject({
      status: "accepted",
      driver: "ST2DRIVER",
      bidFare: 50n,
    });
  });

  it("rejects accept by non-rider", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST3FAKE";
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    const result = contract.acceptBid(0n, "ST2DRIVER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_RIDER);
  });

  it("starts a ride successfully", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    contract.caller = "ST1TEST";
    contract.acceptBid(0n, "ST2DRIVER");
    contract.caller = "ST2DRIVER";
    const result = contract.startRide(0n, "c".repeat(64));
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const ride = contract.getRide(0n);
    expect(ride.ok).toBe(true);
    expect(ride.value).toMatchObject({
      status: "started",
      routeHash: "c".repeat(64),
    });
  });

  it("rejects start by non-driver", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    contract.caller = "ST1TEST";
    contract.acceptBid(0n, "ST2DRIVER");
    contract.caller = "ST3FAKE";
    const result = contract.startRide(0n, "c".repeat(64));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_DRIVER);
  });

  it("completes a ride successfully", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    contract.caller = "ST1TEST";
    contract.acceptBid(0n, "ST2DRIVER");
    contract.caller = "ST2DRIVER";
    contract.startRide(0n, "c".repeat(64));
    const result = contract.completeRide(0n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const ride = contract.getRide(0n);
    expect(ride.ok).toBe(true);
    expect(ride.value?.status).toBe("completed");
  });

  it("cancels a ride successfully", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.blockHeight = 5n;
    const result = contract.cancelRide(0n);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const ride = contract.getRide(0n);
    expect(ride.ok).toBe(true);
    expect(ride.value?.status).toBe("cancelled");
    expect(ride.value?.reputationCheck).toBe(false);
  });

  it("rejects cancel timeout", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.blockHeight = 15n;
    const result = contract.cancelRide(0n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_CANCEL_TIMEOUT);
  });

  it("returns open requests correctly", () => {
    contract.postRideRequest("a".repeat(64), "b".repeat(64), 100n, 1n);
    contract.caller = "ST2DRIVER";
    contract.submitBid(0n, 50n);
    contract.caller = "ST1TEST";
    contract.acceptBid(0n, "ST2DRIVER");
    contract.postRideRequest("d".repeat(64), "e".repeat(64), 200n, 2n);
    const result = contract.getOpenRequests();
    expect(result.ok).toBe(true);
    expect(result.value.rideIds).toEqual([1n]);
  });

  it("parses Clarity types correctly", () => {
    const pickup = stringAsciiCV("a".repeat(64));
    const maxFare = uintCV(100n);
    const urgency = uintCV(1n);
    expect(pickup.value).toBe("a".repeat(64));
    expect(maxFare.value).toEqual(100n);
    expect(urgency.value).toEqual(1n);
  });
});