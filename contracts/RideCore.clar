(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-RIDE-NOT-FOUND u101)
(define-constant ERR-INVALID-PICKUP-HASH u102)
(define-constant ERR-INVALID-DROPOFF-HASH u103)
(define-constant ERR-INVALID-MAX-FARE u104)
(define-constant ERR-INVALID-URGENCY u105)
(define-constant ERR-RIDE-ALREADY-EXISTS u106)
(define-constant ERR-NOT-RIDER u107)
(define-constant ERR-NOT-DRIVER u108)
(define-constant ERR-BID-TOO-HIGH u109)
(define-constant ERR-BID-ALREADY-SUBMITTED u110)
(define-constant ERR-RIDE-NOT-REQUESTED u111)
(define-constant ERR-RIDE-ALREADY-ACCEPTED u112)
(define-constant ERR-RIDE-NOT-ACCEPTED u113)
(define-constant ERR-INVALID-GEO-HASH u114)
(define-constant ERR-RIDE-INVALID-STATUS u115)
(define-constant ERR-CANCEL-TIMEOUT u116)
(define-constant ERR-USER-NOT-REGISTERED u117)

(define-data-var next-ride-id uint u0)

(define-type Ride {
  rider: principal,
  driver: (optional principal),
  status: (string-ascii 20),
  pickup-hash: (string-ascii 64),
  dropoff-hash: (string-ascii 64),
  max-fare: uint,
  bid-fare: (optional uint),
  urgency: uint,
  created-at: uint,
  accepted-at: (optional uint),
  started-at: (optional uint),
  completed-at: (optional uint),
  route-hash: (optional (string-ascii 64)),
  reputation-check: bool
})

(define-map rides { ride-id: uint } Ride)

(define-map bids
  { ride-id: uint, driver: principal }
  { bid-amount: uint, submitted-at: uint }
)

(define-read-only (get-ride (ride-id uint))
  (map-get? rides { ride-id: ride-id })
)

(define-read-only (get-bid (ride-id uint) (driver principal))
  (map-get? bids { ride-id: ride-id, driver: driver })
)

(define-read-only (get-open-requests)
  (ok (list ))
)

(define-private (validate-pickup-hash (hash (string-ascii 64)))
  (if (and (> (len hash) u0) (is-eq (len hash) u64))
    (ok true)
    (err u102)
  )
)

(define-private (validate-dropoff-hash (hash (string-ascii 64)))
  (if (and (> (len hash) u0) (is-eq (len hash) u64))
    (ok true)
    (err u103)
  )
)

(define-private (validate-max-fare (fare uint))
  (if (> fare u0)
    (ok true)
    (err u104)
  )
)

(define-private (validate-urgency (urgency uint))
  (if (and (<= urgency u3) (> urgency u0))
    (ok true)
    (err u105)
  )
)

(define-private (validate-geo-hash (hash (string-ascii 64)))
  (if (and (> (len hash) u0) (is-eq (len hash) u64))
    (ok true)
    (err u114)
  )
)

(define-private (is-rider-authorized (ride Ride) (caller principal))
  (is-eq (get rider ride) caller)
)

(define-private (is-driver-authorized (ride Ride) (caller principal))
  (match (get driver ride) driver-principal (is-eq driver-principal caller) false)
)

(define-private (ride-status-check (ride Ride) (expected (string-ascii 20)))
  (if (is-eq (get status ride) expected)
    (ok true)
    (err u115)
  )
)

(define-public (post-ride-request
  (pickup-hash (string-ascii 64))
  (dropoff-hash (string-ascii 64))
  (max-fare uint)
  (urgency uint)
)
  (let
    (
      (new-id (var-get next-ride-id))
      (validated-pickup (try! (validate-pickup-hash pickup-hash)))
      (validated-dropoff (try! (validate-dropoff-hash dropoff-hash)))
      (validated-fare (try! (validate-max-fare max-fare)))
      (validated-urgency (try! (validate-urgency urgency)))
    )
    (asserts! (is-none (map-get? rides { ride-id: new-id })) (err u106))
    (map-set rides
      { ride-id: new-id }
      {
        rider: tx-sender,
        driver: none,
        status: "requested",
        pickup-hash: pickup-hash,
        dropoff-hash: dropoff-hash,
        max-fare: max-fare,
        bid-fare: none,
        urgency: urgency,
        created-at: block-height,
        accepted-at: none,
        started-at: none,
        completed-at: none,
        route-hash: none,
        reputation-check: true
      }
    )
    (var-set next-ride-id (+ new-id u1))
    (print { event: "ride-requested", id: new-id })
    (ok new-id)
  )
)

(define-public (submit-bid (ride-id uint) (bid-amount uint))
  (let
    (
      (ride (unwrap! (map-get? rides { ride-id: ride-id }) (err u101)))
      (validated-fare (try! (validate-max-fare bid-amount)))
    )
    (try! (ride-status-check ride "requested"))
    (asserts! (<= bid-amount (get max-fare ride)) (err u109))
    (asserts! (is-none (map-get? bids { ride-id: ride-id, driver: tx-sender })) (err u110))
    (map-set bids
      { ride-id: ride-id, driver: tx-sender }
      { bid-amount: bid-amount, submitted-at: block-height }
    )
    (print { event: "bid-submitted", ride-id: ride-id, driver: tx-sender, amount: bid-amount })
    (ok true)
  )
)

(define-public (accept-bid (ride-id uint) (selected-driver principal))
  (let
    (
      (ride (unwrap! (map-get? rides { ride-id: ride-id }) (err u101)))
      (bid (unwrap! (map-get? bids { ride-id: ride-id, driver: selected-driver }) (err u113)))
      (bid-fare (get bid-amount bid))
    )
    (try! (ride-status-check ride "requested"))
    (asserts! (is-rider-authorized ride tx-sender) (err u107))
    (asserts! (<= bid-fare (get max-fare ride)) (err u109))
    (map-set rides
      { ride-id: ride-id }
      {
        rider: (get rider ride),
        driver: (some selected-driver),
        status: "accepted",
        pickup-hash: (get pickup-hash ride),
        dropoff-hash: (get dropoff-hash ride),
        max-fare: (get max-fare ride),
        bid-fare: (some bid-fare),
        urgency: (get urgency ride),
        created-at: (get created-at ride),
        accepted-at: (some block-height),
        started-at: (get started-at ride),
        completed-at: (get completed-at ride),
        route-hash: (get route-hash ride),
        reputation-check: (get reputation-check ride)
      }
    )
    (print { event: "bid-accepted", ride-id: ride-id, driver: selected-driver })
    (ok true)
  )
)

(define-public (start-ride (ride-id uint) (route-hash (string-ascii 64)))
  (let
    (
      (ride (unwrap! (map-get? rides { ride-id: ride-id }) (err u101)))
      (validated-hash (try! (validate-geo-hash route-hash)))
    )
    (try! (ride-status-check ride "accepted"))
    (asserts! (is-driver-authorized ride tx-sender) (err u108))
    (map-set rides
      { ride-id: ride-id }
      {
        rider: (get rider ride),
        driver: (get driver ride),
        status: "started",
        pickup-hash: (get pickup-hash ride),
        dropoff-hash: (get dropoff-hash ride),
        max-fare: (get max-fare ride),
        bid-fare: (get bid-fare ride),
        urgency: (get urgency ride),
        created-at: (get created-at ride),
        accepted-at: (get accepted-at ride),
        started-at: (some block-height),
        completed-at: (get completed-at ride),
        route-hash: (some route-hash),
        reputation-check: (get reputation-check ride)
      }
    )
    (print { event: "ride-started", ride-id: ride-id })
    (ok true)
  )
)

(define-public (complete-ride (ride-id uint))
  (let
    (
      (ride (unwrap! (map-get? rides { ride-id: ride-id }) (err u101)))
    )
    (try! (ride-status-check ride "started"))
    (asserts! (is-driver-authorized ride tx-sender) (err u108))
    (map-set rides
      { ride-id: ride-id }
      {
        rider: (get rider ride),
        driver: (get driver ride),
        status: "completed",
        pickup-hash: (get pickup-hash ride),
        dropoff-hash: (get dropoff-hash ride),
        max-fare: (get max-fare ride),
        bid-fare: (get bid-fare ride),
        urgency: (get urgency ride),
        created-at: (get created-at ride),
        accepted-at: (get accepted-at ride),
        started-at: (get started-at ride),
        completed-at: (some block-height),
        route-hash: (get route-hash ride),
        reputation-check: (get reputation-check ride)
      }
    )
    (print { event: "ride-completed", ride-id: ride-id })
    (ok true)
  )
)

(define-public (cancel-ride (ride-id uint))
  (let
    (
      (ride (unwrap! (map-get? rides { ride-id: ride-id }) (err u101)))
      (time-since-creation (- block-height (get created-at ride)))
    )
    (try! (ride-status-check ride "requested"))
    (asserts! (<= time-since-creation u10) (err u116))
    (asserts! (is-rider-authorized ride tx-sender) (err u107))
    (map-set rides
      { ride-id: ride-id }
      {
        rider: (get rider ride),
        driver: none,
        status: "cancelled",
        pickup-hash: (get pickup-hash ride),
        dropoff-hash: (get dropoff-hash ride),
        max-fare: (get max-fare ride),
        bid-fare: none,
        urgency: (get urgency ride),
        created-at: (get created-at ride),
        accepted-at: none,
        started-at: none,
        completed-at: none,
        route-hash: none,
        reputation-check: false
      }
    )
    (print { event: "ride-cancelled", ride-id: ride-id })
    (ok true)
  )
)